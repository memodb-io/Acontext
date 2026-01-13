package editor

import "fmt"

type MiddleOutStrategy struct{ TokenReduceTo int }

func (s *MiddleOutStrategy) Name() string { return "middle_out" }

func createMiddleOutStrategy(params map[string]interface{}) (EditStrategy, error) {
	return nil, fmt.Errorf("middle_out strategy not implemented")
}
