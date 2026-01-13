package editor

import "fmt"

type MiddleOutStrategy struct{ TokenReduceTo int }

func (s *MiddleOutStrategy) Name() string { return "middle_out" }

func createMiddleOutStrategy(params map[string]interface{}) (EditStrategy, error) {
	if _, ok := params["token_reduce_to"]; !ok {
		return nil, fmt.Errorf("middle_out strategy requires 'token_reduce_to' parameter")
	}
	return nil, fmt.Errorf("middle_out strategy not implemented")
}
