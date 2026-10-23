package prompt

import _ "embed"

//go:embed tutor_system.md
var TutorSystem string

//go:embed persona_socrates.md
var PersonaSocrates string

//go:embed persona_coach.md
var PersonaCoach string

//go:embed persona_expert.md
var PersonaExpert string

//go:embed explain_confusion.md
var ExplainConfusion string

//go:embed rubric_grade.md
var RubricGrade string

//go:embed behavior_report.md
var BehaviorReport string

func GetPersonaPrompt(persona string) string {
	switch persona {
	case "socrates":
		return PersonaSocrates
	case "coach":
		return PersonaCoach
	case "expert":
		return PersonaExpert
	default:
		return PersonaCoach
	}
}
