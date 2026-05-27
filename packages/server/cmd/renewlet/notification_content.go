package main

// notification_content.go 将订阅投影转换为可发送的通知内容。
//
// 架构位置：调度器、手动运行和测试发送共享同一套内容构建，确保历史记录、渠道文本和前端预览口径一致。
// 这里刻意按 date-only 计算提醒窗口，因为扣费日是用户本地业务日期，不应被 UTC instant 或 DST 影响。
//
// 注意： 调整 item type 或文案分组会影响所有渠道文本和 notification job result schema。
import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

const notificationSubscriptionPageSize = 500

// listNotificationSubscriptions 读取通知计算所需的订阅投影。
func listNotificationSubscriptions(app core.App, userID string) ([]notificationSubscription, error) {
	subscriptions := []notificationSubscription{}
	for offset := 0; ; offset += notificationSubscriptionPageSize {
		rows, err := app.FindRecordsByFilter("subscriptions", "user = {:user}", "-created", notificationSubscriptionPageSize, offset, dbx.Params{"user": userID})
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			subscriptions = append(subscriptions, notificationSubscriptionFromRecord(row))
		}
		if len(rows) < notificationSubscriptionPageSize {
			return subscriptions, nil
		}
	}
}

func notificationSubscriptionFromRecord(row *core.Record) notificationSubscription {
	return notificationSubscription{
		ID:                     row.Id,
		Name:                   row.GetString("name"),
		LogoURL:                row.GetString("logo"),
		Price:                  row.GetFloat("price"),
		Currency:               row.GetString("currency"),
		Status:                 row.GetString("status"),
		BillingCycle:           row.GetString("billingCycle"),
		NextBillingDate:        row.GetString("nextBillingDate"),
		TrialEndDate:           row.GetString("trialEndDate"),
		ReminderDays:           row.GetInt("reminderDays"),
		RepeatReminderEnabled:  row.GetBool("repeatReminderEnabled"),
		RepeatReminderInterval: normalizeRepeatReminderInterval(row.GetString("repeatReminderInterval")),
		RepeatReminderWindow:   normalizeRepeatReminderWindow(row.GetString("repeatReminderWindow")),
	}
}

func normalizeNotificationReminderDays(value int) int {
	if value < 0 || value > maxReminderDays {
		return defaultNotificationReminderDays
	}
	return value
}

func isInheritReminderDays(value int) bool {
	return value == inheritReminderDays
}

func effectiveReminderDays(sub notificationSubscription, settings appSettings) int {
	// -1 是跨 Wallos 导入、前端表单、Go/PocketBase 和 Cloudflare 的继承哨兵；通知历史只输出解析后的非负天数。
	if isInheritReminderDays(sub.ReminderDays) {
		return normalizeNotificationReminderDays(settings.NotificationReminderDays)
	}
	if sub.ReminderDays < 0 || sub.ReminderDays > maxReminderDays {
		return defaultNotificationReminderDays
	}
	return sub.ReminderDays
}

// buildTestNotification 构造测试通知内容。
func buildTestNotification(now time.Time, settings appSettings) notificationMessage {
	locale := normalizeAppLocale(settings.Locale)
	return notificationMessage{
		Title:      serverText(locale, "notification.content.testTitle"),
		Content:    serverText(locale, "notification.content.testBody"),
		Timestamp:  formatNotificationTime(now, settings.Timezone),
		Items:      []notificationContentItem{},
		HasPayload: true,
	}
}

// buildDueNotification 根据当前时间和用户时区构造到期提醒。
func buildDueNotification(now time.Time, settings appSettings, subscriptions []notificationSubscription, includeExpired bool) notificationMessage {
	localDate := todayDateOnly(now, settings.Timezone)
	items := collectNotificationItems(localDate, settings, subscriptions, includeExpired)
	return buildNotificationContent(now, settings, items)
}

// buildDueNotificationForLocalDate 按指定本地日期构造提醒。
func buildDueNotificationForLocalDate(localDate string, now time.Time, settings appSettings, subscriptions []notificationSubscription, includeExpired bool) notificationMessage {
	items := collectNotificationItems(localDate, settings, subscriptions, includeExpired)
	return buildNotificationContent(now, settings, items)
}

func buildDueNotificationForSchedule(schedule localScheduleOccurrence, now time.Time, settings appSettings, subscriptions []notificationSubscription, includeExpired bool) notificationMessage {
	items := collectNotificationItemsForSchedule(schedule, settings, subscriptions, includeExpired)
	return buildNotificationContent(now, settings, items)
}

func collectNotificationItemsForSchedule(schedule localScheduleOccurrence, settings appSettings, subscriptions []notificationSubscription, includeExpired bool) []notificationContentItem {
	items := []notificationContentItem{}
	if schedule.ScheduledLocalTime == settings.NotificationTimeLocal {
		items = append(items, collectNotificationItems(schedule.ScheduledLocalDate, settings, subscriptions, includeExpired)...)
	}
	items = append(items, collectRepeatNotificationItems(schedule, settings, subscriptions)...)
	return items
}

// collectNotificationItems 收集指定本地日期应该提醒的项目。
// 为什么用 date-only 差值：订阅扣费日是业务日期，不应受 UTC instant 或 DST 切换影响。
func collectNotificationItems(localDate string, settings appSettings, subscriptions []notificationSubscription, includeExpired bool) []notificationContentItem {
	items := []notificationContentItem{}
	for _, sub := range subscriptions {
		if sub.BillingCycle == "one-time" {
			// one-time 是买断记录，通知系统不能把购买日当成续费日、试用日或过期日反复提醒。
			continue
		}
		reminderDays := effectiveReminderDays(sub, settings)
		if isValidDateOnly(sub.NextBillingDate) {
			daysUntilNext := daysBetweenDateOnly(localDate, sub.NextBillingDate)
			if daysUntilNext < 0 {
				if settings.ShowExpired && includeExpired {
					items = append(items, newNotificationContentItem("expired", sub, sub.NextBillingDate, daysUntilNext, reminderDays, nil))
				}
			} else if daysUntilNext == reminderDays {
				items = append(items, newNotificationContentItem("renewal", sub, sub.NextBillingDate, daysUntilNext, reminderDays, nil))
			}
		}

		if sub.Status == "trial" && isValidDateOnly(sub.TrialEndDate) {
			daysUntilTrialEnd := daysBetweenDateOnly(localDate, sub.TrialEndDate)
			if daysUntilTrialEnd == reminderDays {
				items = append(items, newNotificationContentItem("trial", sub, sub.TrialEndDate, daysUntilTrialEnd, reminderDays, nil))
			}
		}
	}
	return items
}

func collectRepeatNotificationItems(schedule localScheduleOccurrence, settings appSettings, subscriptions []notificationSubscription) []notificationContentItem {
	scheduledInstant, err := time.Parse(time.RFC3339, schedule.ScheduledInstantUTC)
	if err != nil {
		return []notificationContentItem{}
	}
	items := []notificationContentItem{}
	for _, sub := range subscriptions {
		if sub.BillingCycle == "one-time" {
			continue
		}
		if !sub.RepeatReminderEnabled {
			continue
		}
		reminderDays := effectiveReminderDays(sub, settings)
		repeat := &repeatReminderSnapshot{
			Interval: normalizeRepeatReminderInterval(sub.RepeatReminderInterval),
			Window:   normalizeRepeatReminderWindow(sub.RepeatReminderWindow),
		}
		if isValidDateOnly(sub.NextBillingDate) && repeatReminderOccurrenceMatches(scheduledInstant, settings, reminderDays, sub.NextBillingDate, repeat) {
			items = append(items, newNotificationContentItem("renewal", sub, sub.NextBillingDate, daysBetweenDateOnly(schedule.ScheduledLocalDate, sub.NextBillingDate), reminderDays, repeat))
		}
		if sub.Status == "trial" && isValidDateOnly(sub.TrialEndDate) && repeatReminderOccurrenceMatches(scheduledInstant, settings, reminderDays, sub.TrialEndDate, repeat) {
			items = append(items, newNotificationContentItem("trial", sub, sub.TrialEndDate, daysBetweenDateOnly(schedule.ScheduledLocalDate, sub.TrialEndDate), reminderDays, repeat))
		}
	}
	return items
}

func newNotificationContentItem(itemType string, sub notificationSubscription, targetDate string, daysUntil int, reminderDays int, repeat *repeatReminderSnapshot) notificationContentItem {
	status := normalizeSubscriptionStatus(sub.Status)
	if itemType == "trial" {
		status = "trial"
	}
	return notificationContentItem{
		Type:           itemType,
		SubscriptionID: sub.ID,
		Name:           sub.Name,
		LogoURL:        sub.LogoURL,
		Price:          sub.Price,
		Currency:       sub.Currency,
		Status:         status,
		TargetDate:     targetDate,
		ReminderDays:   reminderDays,
		DaysUntil:      daysUntil,
		RepeatReminder: repeat,
	}
}

func repeatReminderOccurrenceMatches(scheduledInstant time.Time, settings appSettings, reminderDays int, targetDate string, repeat *repeatReminderSnapshot) bool {
	targetInstant, err := getScheduleInstant(targetDate, settings.NotificationTimeLocal, settings.Timezone)
	if err != nil {
		return false
	}
	firstInstant, err := getScheduleInstant(addDateOnly(targetDate, -reminderDays), settings.NotificationTimeLocal, settings.Timezone)
	if err != nil {
		return false
	}
	if !scheduledInstant.After(firstInstant) || scheduledInstant.After(targetInstant) {
		return false
	}
	windowStart := firstInstant
	if duration, full := repeatReminderWindowDuration(repeat.Window); !full {
		candidate := targetInstant.Add(-duration)
		if candidate.After(windowStart) {
			windowStart = candidate
		}
	}
	if scheduledInstant.Before(windowStart) {
		return false
	}
	elapsed := scheduledInstant.Sub(firstInstant)
	interval := repeatReminderIntervalDuration(repeat.Interval)
	return interval > 0 && elapsed%interval == 0
}

// buildNotificationContent 将提醒项分组为可读消息。
func buildNotificationContent(now time.Time, settings appSettings, items []notificationContentItem) notificationMessage {
	locale := normalizeAppLocale(settings.Locale)
	renewals := []string{}
	trials := []string{}
	expired := []string{}
	for _, item := range items {
		line := formatNotificationItemLine(item, locale)
		switch item.Type {
		case "trial":
			trials = append(trials, line)
		case "expired":
			expired = append(expired, line)
		default:
			renewals = append(renewals, line)
		}
	}

	blocks := []string{}
	if len(renewals) > 0 {
		blocks = append(blocks, serverText(locale, "notification.content.renewalBlock")+"\n"+strings.Join(renewals, "\n"))
	}
	if len(trials) > 0 {
		blocks = append(blocks, serverText(locale, "notification.content.trialBlock")+"\n"+strings.Join(trials, "\n"))
	}
	if len(expired) > 0 {
		blocks = append(blocks, serverText(locale, "notification.content.expiredBlock")+"\n"+strings.Join(expired, "\n"))
	}
	hasPayload := len(blocks) > 0
	content := serverText(locale, "notification.content.empty")
	if hasPayload {
		content = strings.Join(blocks, "\n\n")
	}
	return notificationMessage{
		Title:      serverText(locale, "notification.content.title"),
		Content:    content,
		Timestamp:  formatNotificationTime(now, settings.Timezone),
		Items:      items,
		HasPayload: hasPayload,
	}
}

func formatNotificationItemLine(item notificationContentItem, locale appLocale) string {
	extra := serverFormat(locale, "notification.content.reminderDays", map[string]interface{}{"days": item.ReminderDays})
	if item.Type == "trial" {
		extra = serverFormat(locale, "notification.content.trialReminderDays", map[string]interface{}{"days": item.ReminderDays})
	} else if item.Type == "expired" {
		extra = serverText(locale, "notification.content.expiredStatus")
	}
	if item.RepeatReminder != nil {
		extra += serverText(locale, "notification.content.repeatSeparator") + formatRepeatReminderText(item.RepeatReminder.Interval, locale)
	}
	return serverFormat(locale, "notification.content.itemLine", map[string]interface{}{
		"name":       item.Name,
		"targetDate": item.TargetDate,
		"amount":     formatAmount(item.Price),
		"currency":   item.Currency,
		"extra":      extra,
	})
}

func formatRepeatReminderText(interval string, locale appLocale) string {
	hours := repeatReminderIntervalHours(interval)
	return serverFormat(locale, "notification.content.repeatEvery", map[string]interface{}{"hours": hours})
}

func formatAmount(amount float64) string {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return fmt.Sprintf("%v", amount)
	}
	fixed := strconv.FormatFloat(amount, 'f', 2, 64)
	fixed = strings.TrimSuffix(fixed, ".00")
	if strings.HasSuffix(fixed, "0") && strings.Contains(fixed, ".") {
		fixed = strings.TrimSuffix(fixed, "0")
	}
	return fixed
}

func formatNotificationTime(now time.Time, timezone string) string {
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
		timezone = "UTC"
	}
	return now.In(loc).Format("2006-01-02 15:04:05") + " " + timezone
}

func normalizeSubscriptionStatus(status string) string {
	switch status {
	case "trial", "active", "paused", "cancelled":
		return status
	default:
		return "active"
	}
}
