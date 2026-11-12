package configuration

import (
	"fmt"
	"io"
	"strings"

	apipb "github.com/usememos/memos/proto/gen/api"
)

var actionSymbols = map[apipb.ResourceChange_Action]string{
	apipb.ResourceChange_CREATE:  "+",
	apipb.ResourceChange_ADOPT:   "~",
	apipb.ResourceChange_UPDATE:  "~",
	apipb.ResourceChange_DESTROY: "-",
	apipb.ResourceChange_RESET:   "-/+",
	apipb.ResourceChange_RELEASE: ".",
	apipb.ResourceChange_ERROR:   "!",
}

// RenderPlan writes a plan as text in the shape Terraform operators know: a
// summary line, then one line per resource apply would act on, with the
// fields it would write beneath updates and adoptions.
func RenderPlan(w io.Writer, plan *apipb.Plan) {
	counts := map[apipb.ResourceChange_Action]int{}
	width, symbolWidth := 0, 0
	for _, change := range plan.ResourceChanges {
		counts[change.Action]++
		if change.Action != apipb.ResourceChange_NO_OP {
			width = max(width, len(change.Resource))
			symbolWidth = max(symbolWidth, len(actionSymbols[change.Action]))
		}
	}

	resourceWrites := len(plan.ResourceChanges) - counts[apipb.ResourceChange_NO_OP] - counts[apipb.ResourceChange_ERROR]
	switch {
	case len(plan.Errors) > 0:
		fmt.Fprintln(w, "The plan cannot be applied.")
	case resourceWrites == 0 && !plan.StateRecordChanges:
		fmt.Fprintln(w, "No changes. The instance matches the configuration.")
	case resourceWrites == 0:
		fmt.Fprintln(w, "No resource changes. Apply would only update the state record.")
	default:
		summary := fmt.Sprintf("Plan: %d to create, %d to update, %d to destroy",
			counts[apipb.ResourceChange_CREATE], counts[apipb.ResourceChange_UPDATE],
			counts[apipb.ResourceChange_DESTROY]+counts[apipb.ResourceChange_RESET])
		var extras []string
		if n := counts[apipb.ResourceChange_ADOPT]; n > 0 {
			extras = append(extras, fmt.Sprintf("%d to adopt", n))
		}
		if n := counts[apipb.ResourceChange_RELEASE]; n > 0 {
			extras = append(extras, fmt.Sprintf("%d to release", n))
		}
		if len(extras) > 0 {
			summary += "; " + strings.Join(extras, ", ")
		}
		fmt.Fprintln(w, summary+".")
	}

	if len(plan.ResourceChanges) > counts[apipb.ResourceChange_NO_OP] {
		fmt.Fprintln(w)
	}
	for _, change := range plan.ResourceChanges {
		if change.Action == apipb.ResourceChange_NO_OP {
			continue
		}
		line := fmt.Sprintf("  %*s %-*s", symbolWidth, actionSymbols[change.Action], width, change.Resource)
		if change.Source != "" {
			line += "  (" + change.Source + ")"
		}
		if label := actionLabel(change); label != "" {
			line += "  " + label
		}
		fmt.Fprintln(w, strings.TrimRight(line, " "))
		if change.Message != "" {
			fmt.Fprintln(w, "        # "+change.Message)
		}
		if change.Action != apipb.ResourceChange_UPDATE && change.Action != apipb.ResourceChange_ADOPT {
			continue
		}
		pathWidth := 0
		for _, field := range change.FieldChanges {
			pathWidth = max(pathWidth, len(field.Path)+1)
		}
		for _, field := range change.FieldChanges {
			fmt.Fprintf(w, "        %-*s %s -> %s\n", pathWidth, field.Path+":", orNone(field.Before), orNone(field.After))
		}
	}

	for _, warning := range plan.Warnings {
		fmt.Fprintln(w, "\nWarning: "+warning)
	}
	for _, problem := range plan.Errors {
		fmt.Fprintln(w, "\nError: "+problem)
	}
}

func actionLabel(change *apipb.ResourceChange) string {
	switch {
	case change.Drift:
		return "drift"
	case change.Action == apipb.ResourceChange_ADOPT:
		return "adopt"
	case change.Action == apipb.ResourceChange_RESET:
		return "reset"
	case change.Action == apipb.ResourceChange_RELEASE:
		return "release"
	default:
		return ""
	}
}

func orNone(value string) string {
	if value == "" {
		return "(none)"
	}
	return value
}
