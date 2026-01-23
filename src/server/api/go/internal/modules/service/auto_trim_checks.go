package service

// checkTokensGte returns true when tokens are greater than or equal to threshold.
func checkTokensGte(tokens int, threshold int) bool {
	return tokens >= threshold
}
