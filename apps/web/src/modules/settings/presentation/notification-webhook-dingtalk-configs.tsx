import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n/I18nProvider';
import {
  WEBHOOK_HEADERS_PLACEHOLDER,
  WEBHOOK_PAYLOAD_PLACEHOLDER,
  type AppSettings,
} from '@/types/subscription';
import type { UpdateSetting } from './settings-shared-controls';

type NotificationProtocolConfigProps = {
  settings: AppSettings;
  updateSetting: UpdateSetting;
  disabled: boolean;
  testButton: ReactNode;
};

export function NotificationWebhookConfigPanel({
  settings,
  updateSetting,
  disabled,
  testButton,
}: NotificationProtocolConfigProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            name="webhookUrl"
            type="url"
            inputMode="url"
            enterKeyHint="next"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://your-webhook-endpoint.com/path"
            value={settings.webhookUrl}
            disabled={disabled}
            onChange={(e) => updateSetting('webhookUrl', e.target.value)}
            className="border-border bg-secondary"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.webhookGetPostHelp")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="webhookMethod">{t("settings.webhookMethod")}</Label>
            <Select
              value={settings.webhookMethod}
              disabled={disabled}
              onValueChange={(value) => updateSetting('webhookMethod', value as 'GET' | 'POST')}
            >
              <SelectTrigger className="border-border bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="webhookHeaders">{t("settings.webhookHeaders")}</Label>
          <Textarea
            id="webhookHeaders"
            placeholder={WEBHOOK_HEADERS_PLACEHOLDER}
            value={settings.webhookHeaders}
            disabled={disabled}
            onChange={(e) => updateSetting('webhookHeaders', e.target.value)}
            className="min-h-[80px] border-border bg-secondary font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">{t("settings.webhookHeadersHelp")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="webhookPayload">{t("settings.webhookPayload")}</Label>
          <Textarea
            id="webhookPayload"
            placeholder={WEBHOOK_PAYLOAD_PLACEHOLDER}
            value={settings.webhookPayload}
            disabled={disabled}
            onChange={(e) => updateSetting('webhookPayload', e.target.value)}
            className="min-h-[80px] border-border bg-secondary font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.webhookPayloadHelp")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        {testButton}
      </div>
    </>
  );
}

export function NotificationDingTalkConfigPanel({
  settings,
  updateSetting,
  disabled,
  testButton,
}: NotificationProtocolConfigProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dingtalkWebhookUrl">{t("settings.dingtalkWebhookUrl")}</Label>
          <Input
            id="dingtalkWebhookUrl"
            name="dingtalkWebhookUrl"
            type="url"
            inputMode="url"
            enterKeyHint="next"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            value={settings.dingtalkWebhookUrl}
            disabled={disabled}
            onChange={(e) => updateSetting('dingtalkWebhookUrl', e.target.value)}
            className="border-border bg-secondary"
          />
          <p className="text-xs text-muted-foreground">{t("settings.dingtalkWebhookHelp")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="dingtalkMessageType">{t("settings.messageType")}</Label>
            <Select
              value={settings.dingtalkMessageType}
              disabled={disabled}
              onValueChange={(value) => updateSetting('dingtalkMessageType', value as 'markdown' | 'text')}
            >
              <SelectTrigger className="border-border bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="text">{t("settings.textMessage")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dingtalkKeyword">{t("settings.dingtalkKeyword")}</Label>
            <Input
              id="dingtalkKeyword"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Renewlet"
              value={settings.dingtalkKeyword}
              disabled={disabled}
              onChange={(e) => updateSetting('dingtalkKeyword', e.target.value)}
              className="border-border bg-secondary"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dingtalkSecret">{t("settings.dingtalkSecret")}</Label>
          <Input
            id="dingtalkSecret"
            type="password"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="new-password"
            value={settings.dingtalkSecret}
            disabled={disabled}
            onChange={(e) => updateSetting('dingtalkSecret', e.target.value)}
            className="border-border bg-secondary"
          />
          <p className="text-xs text-muted-foreground">{t("settings.dingtalkSecretHelp")}</p>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t("settings.dingtalkSecurityHelp")}</p>
      </div>
      <div className="mt-4 flex justify-end">
        {testButton}
      </div>
    </>
  );
}
