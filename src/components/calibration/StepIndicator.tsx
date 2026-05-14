import type { CalibrationStep, CalibrationStepStatus } from "@/hooks/useCalibration";

const STEPS: { id: CalibrationStep; label: string }[] = [
  { id: "camera",     label: "CAM" },
  { id: "mic",        label: "MIC" },
  { id: "upper_body", label: "BODY" },
  { id: "both_arms",  label: "ARMS" },
  { id: "motion_test",label: "MOTION" },
];

interface Props {
  step: CalibrationStep;
  stepStatus: CalibrationStepStatus;
}

export function StepIndicator({ step, stepStatus }: Props) {
  const currentIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const isDone   = i < currentIdx || (i === currentIdx && stepStatus === "pass");
        const isActive = i === currentIdx && stepStatus !== "pass";
        const isFailed = isActive && stepStatus === "fail";

        return (
          <div key={s.id} className="flex items-center">
            {i > 0 && (
              <div className={`h-px w-5 transition-colors duration-300 ${isDone ? "bg-pool" : "bg-surface-2"}`} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                isFailed  ? "bg-coral ring-2 ring-coral/25" :
                isDone    ? "bg-pool" :
                isActive  ? "bg-pool ring-2 ring-pool/25 animate-pulse" :
                "bg-surface-2"
              }`} />
              <span className={`text-[9px] tracking-[0.12em] font-semibold transition-colors duration-300 uppercase ${
                isFailed  ? "text-coral" :
                isDone    ? "text-pool" :
                isActive  ? "text-text" :
                "text-muted/30"
              }`}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
