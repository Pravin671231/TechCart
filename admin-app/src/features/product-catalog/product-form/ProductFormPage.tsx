import { useState } from "react";
import { useNavigate } from "react-router";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LuChevronRight } from "react-icons/lu";
import { QuickNavPanel } from "@/features/product-catalog/product-form/components/QuickNavPanel";
import { CompletionBar } from "@/features/product-catalog/product-form/components/CompletionBar";
import { ProductInformationStep } from "@/features/product-catalog/product-form/steps/ProductInformationStep";
import { UploadMediaStep } from "@/features/product-catalog/product-form/steps/UploadMediaStep";
import { PricingInventoryStep } from "@/features/product-catalog/product-form/steps/PricingInventoryStep";
import { SpecificationsStep } from "@/features/product-catalog/product-form/steps/SpecificationsStep";
import { VariantsStep } from "@/features/product-catalog/product-form/steps/VariantsStep";
import { SeoStep } from "@/features/product-catalog/product-form/steps/SeoStep";
import { mockCategorySchema } from "@/features/product-catalog/product-form/mockCategorySchema";
import {
  buildDefaultValues,
  buildProductFormSchema,
  stepFieldNames,
  type ProductFormValues,
} from "@/features/product-catalog/product-form/productFormSchema";
import { stepOrder, type StepId } from "@/features/product-catalog/product-form/types";

const productFormSchema = buildProductFormSchema(mockCategorySchema);

const stepComponents: Record<StepId, () => React.JSX.Element> = {
  info: ProductInformationStep,
  media: UploadMediaStep,
  pricing: PricingInventoryStep,
  specs: SpecificationsStep,
  variants: VariantsStep,
  seo: SeoStep,
};

export function ProductFormPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StepId>("info");
  const [visitedSteps, setVisitedSteps] = useState<Set<StepId>>(new Set());

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: buildDefaultValues(mockCategorySchema),
    mode: "onSubmit",
  });
  const { trigger, handleSubmit } = methods;

  // Step-index-based, not a required-field ratio — see design.md discussion:
  // this deliberately won't reproduce a reference template's "40% on step 2"
  // (that math is 2/5, a 5-step layout, not this SRS-driven 6-step one).
  const stepIndex = stepOrder.indexOf(currentStep);
  const completion = Math.round(((stepIndex + 1) / stepOrder.length) * 100);
  const isLastStep = currentStep === "seo";

  function goToStep(step: StepId) {
    setCurrentStep(step);
  }

  async function handleGoNext() {
    const isStepValid = await trigger(stepFieldNames[currentStep]);
    if (!isStepValid) return;

    setVisitedSteps((prev) => new Set(prev).add(currentStep));

    if (isLastStep) {
      handleSubmit(() => navigate("/product-catalog/products"))();
      return;
    }

    setCurrentStep(stepOrder[stepIndex + 1]);
  }

  function handleSaveDraft() {
    navigate("/product-catalog/products");
  }

  function handleCancel() {
    navigate("/product-catalog/products");
  }

  const ActiveStep = stepComponents[currentStep];

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col">
        <div className="mb-6">
          <nav className="mb-1 flex items-center gap-1 text-sm text-neutral-500">
            <span className="flex items-center gap-1">
              Ecommerce
              <LuChevronRight className="h-3.5 w-3.5 shrink-0" />
            </span>
            <span className="flex items-center gap-1">
              All Product
              <LuChevronRight className="h-3.5 w-3.5 shrink-0" />
            </span>
            <span className="font-semibold text-primary-800">Add Product</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-800">Add Product</h1>
          <p className="mt-1 text-sm text-neutral-500">Add product properly with our easy to add flow</p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <QuickNavPanel currentStep={currentStep} visitedSteps={visitedSteps} onSelect={goToStep} />
          <div className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white p-6">
            <ActiveStep />
          </div>
        </div>

        <CompletionBar
          percent={completion}
          onSaveDraft={handleSaveDraft}
          onCancel={handleCancel}
          onGoNext={handleGoNext}
          isLastStep={isLastStep}
        />
      </div>
    </FormProvider>
  );
}
