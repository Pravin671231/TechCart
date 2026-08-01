import { LuCheck } from "react-icons/lu";
import { stepLabels, stepOrder, type StepId } from "@/features/product-catalog/product-form/types";

type QuickNavPanelProps = {
  currentStep: StepId;
  visitedSteps: Set<StepId>;
  onSelect: (step: StepId) => void;
};

export function QuickNavPanel({ currentStep, visitedSteps, onSelect }: QuickNavPanelProps) {
  return (
    <nav
      aria-label="Quick Navigation"
      className="w-full shrink-0 rounded-xl border border-neutral-200 bg-white p-2 lg:w-64"
    >
      <p className="px-3 py-2 text-xs font-medium tracking-wider text-neutral-500 uppercase">
        Quick Navigation
      </p>
      <ul className="flex flex-col gap-1">
        {stepOrder.map((step) => {
          const isActive = step === currentStep;
          const isVisited = visitedSteps.has(step) && !isActive;
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => onSelect(step)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-primary-50 font-medium text-primary-800"
                    : isVisited
                      ? "text-neutral-700 hover:bg-neutral-50"
                      : "text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                {stepLabels[step]}
                {isVisited ? <LuCheck className="h-4 w-4 shrink-0 text-primary-600" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
