uniform vec4 uMovementValue;
uniform vec4 uStrengthValue;
uniform vec4 uPeriodValue;
out vec4 vWaveParams;

void filterMain(float lifetime) {
  const float pi2 = 3.14159265;
  vWaveParams = vec4(getValueFromTime(lifetime, uPeriodValue) * pi2, getValueFromTime(lifetime, uMovementValue) * pi2, getValueFromTime(lifetime, uStrengthValue), 0.);
}
