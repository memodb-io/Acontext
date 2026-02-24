package editingtrigger

// checkBuilder returns a check and whether it should be included for a trigger.
type checkBuilder func(trigger *Trigger) (Check, bool)

var registeredCheckBuilders []checkBuilder

func registerCheckBuilder(builder checkBuilder) {
	registeredCheckBuilders = append(registeredCheckBuilders, builder)
}

func listCheckBuilders() []checkBuilder {
	return registeredCheckBuilders
}
