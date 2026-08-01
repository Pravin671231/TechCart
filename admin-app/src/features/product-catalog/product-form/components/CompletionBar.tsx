type CompletionBarProps = {
  percent: number;
  onSaveDraft: () => void;
  onCancel: () => void;
  onGoNext: () => void;
  isLastStep: boolean;
};

export function CompletionBar({ percent, onSaveDraft, onCancel, onGoNext, isLastStep }: CompletionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t border-neutral-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:-mx-6 md:rounded-xl md:border md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-600">
          Product completion <strong className="font-semibold text-neutral-800">{percent}%</strong>
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-primary-600" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSaveDraft}
          className="h-10 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onGoNext}
          className="h-10 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {isLastStep ? "Save Product" : "Go Next"}
        </button>
      </div>
    </div>
  );
}
