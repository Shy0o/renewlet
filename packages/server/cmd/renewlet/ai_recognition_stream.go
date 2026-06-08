package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

const (
	aiRecognitionStreamStageInputRead   = "input-read"
	aiRecognitionStreamStageModelStart  = "model-start"
	aiRecognitionStreamStageModelStream = "model-stream"
	aiRecognitionStreamStageRepairStart = "repair-start"
	aiRecognitionStreamStageValidating  = "validating"
	aiRecognitionStreamStageFinalizing  = "finalizing"
)

type aiRecognitionStreamSink interface {
	Progress(stage string) error
	Partial(subscriptionsSeen int, warningsSeen int) error
	Final(response aiRecognizeResponse) error
}

type aiRecognitionStreamEvent struct {
	Type string `json:"type"`
}

type aiRecognitionStreamProgressEvent struct {
	Type  string `json:"type"`
	Stage string `json:"stage"`
}

type aiRecognitionStreamPartialEvent struct {
	Type              string `json:"type"`
	SubscriptionsSeen int    `json:"subscriptionsSeen"`
	WarningsSeen      int    `json:"warningsSeen"`
}

type aiRecognitionStreamFinalEvent struct {
	Type     string              `json:"type"`
	Response aiRecognizeResponse `json:"response"`
}

type aiRecognitionStreamErrorEvent struct {
	Type    string                     `json:"type"`
	Message string                     `json:"message"`
	Code    string                     `json:"code"`
	Details *aiRecognitionErrorDetails `json:"details,omitempty"`
}

type aiRecognitionSSEWriter struct {
	response   http.ResponseWriter
	controller *http.ResponseController
}

func handleAIRecognizeSubscriptionsStream(app core.App, e *core.RequestEvent) error {
	runContext, err := prepareAIRecognitionRunContext(app, e)
	if err != nil {
		return err
	}
	writer := aiRecognitionSSEWriter{response: e.Response, controller: http.NewResponseController(e.Response)}
	writer.prepareHeaders()
	if err := writer.Progress(aiRecognitionStreamStageInputRead); err != nil {
		return nil
	}
	err = defaultAIRecognitionRunner.Stream(
		e.Request.Context(),
		runContext.AISettings,
		runContext.Input,
		runContext.Locale,
		runContext.Settings.Timezone,
		runContext.Settings.DefaultCurrency,
		runContext.ConfigContext,
		&writer,
	)
	if err != nil {
		_ = writer.Error(aiRecognitionStreamErrorForError(runContext.Locale, err))
	}
	return nil
}

func (writer *aiRecognitionSSEWriter) prepareHeaders() {
	headers := writer.response.Header()
	headers.Set("Content-Type", "text/event-stream; charset=utf-8")
	headers.Set("Cache-Control", "no-store")
	headers.Set("X-Content-Type-Options", "nosniff")
	headers.Set("X-Accel-Buffering", "no")
}

func (writer *aiRecognitionSSEWriter) Progress(stage string) error {
	return writer.write(aiRecognitionStreamProgressEvent{Type: "recognition/progress", Stage: stage})
}

func (writer *aiRecognitionSSEWriter) Partial(subscriptionsSeen int, warningsSeen int) error {
	return writer.write(aiRecognitionStreamPartialEvent{
		Type:              "recognition/partial",
		SubscriptionsSeen: subscriptionsSeen,
		WarningsSeen:      warningsSeen,
	})
}

func (writer *aiRecognitionSSEWriter) Final(response aiRecognizeResponse) error {
	// 流式 partial 只负责可见进度，最终草稿仍以 final 事件里的完整脱敏响应为唯一事实源。
	return writer.write(aiRecognitionStreamFinalEvent{Type: "recognition/final", Response: response})
}

func (writer *aiRecognitionSSEWriter) Error(event aiRecognitionStreamErrorEvent) error {
	return writer.write(event)
}

func (writer *aiRecognitionSSEWriter) write(event interface{}) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	var typed aiRecognitionStreamEvent
	if err := json.Unmarshal(data, &typed); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer.response, "event: %s\ndata: %s\n\n", typed.Type, data); err != nil {
		return err
	}
	return writer.controller.Flush()
}

func aiRecognitionStreamErrorForError(locale appLocale, err error) aiRecognitionStreamErrorEvent {
	message := serverText(locale, "aiRecognition.failed")
	code := "AI_RECOGNITION_FAILED"
	reason := "provider_failed"
	if errors.Is(err, errAIRecognitionNoSubscriptions) {
		message = serverText(locale, "aiRecognition.noSubscriptions")
		code = "AI_RECOGNITION_EMPTY"
		reason = "empty"
	} else if isAIRecognitionSchemaMismatchError(err) {
		message = serverText(locale, "aiRecognition.schemaMismatch")
		code = "AI_RECOGNITION_SCHEMA_MISMATCH"
		reason = "schema_mismatch"
	}

	var details *aiRecognitionErrorDetails
	if diagnostics := aiRecognitionDiagnosticsFromError(err); diagnostics != nil {
		details = &aiRecognitionErrorDetails{
			Reason:          reason,
			ProviderMessage: safeAIRecognitionProviderMessage(aiRecognitionCauseError(err)),
			Diagnostics:     *diagnostics,
		}
	}
	return aiRecognitionStreamErrorEvent{
		Type:    "recognition/error",
		Message: message,
		Code:    code,
		Details: details,
	}
}
