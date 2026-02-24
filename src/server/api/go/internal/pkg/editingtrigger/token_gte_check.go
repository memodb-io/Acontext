package editingtrigger

import "context"

func init() {
	registerCheckBuilder(buildTokenGteCheck)
}

func buildTokenGteCheck(trigger *Trigger) (Check, bool) {
	if trigger == nil || trigger.TokenGte == nil || *trigger.TokenGte <= 0 {
		return nil, false
	}

	threshold := *trigger.TokenGte
	check := func(ctx context.Context, eval *Eval) (bool, error) {
		tokens, err := eval.Tokens(ctx)
		if err != nil {
			return false, err
		}
		return tokens >= threshold, nil
	}
	return check, true
}
