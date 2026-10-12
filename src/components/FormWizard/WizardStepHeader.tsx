import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * KNG-137: the wizard's progress bar and step title, kept out of FormWizard.tsx so its edit there
 * stays a thin call site.
 */

export interface WizardStepProgressItem {
    key: string | number;
    name?: string | null;
    isDone: boolean;
    isCurrent: boolean;
}

export interface StepStripScrollMetrics {
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
}

export interface StepStripOverflow {
    left: boolean;
    right: boolean;
}

/** Sub-pixel rounding in scroll metrics would otherwise flash a fade at the strip's ends. */
const OVERFLOW_TOLERANCE_PX = 2;

/**
 * KNG-168: which sides of the step strip hide steps, from the scroll container's metrics. Pure, so
 * it can be tested without layout (jsdom reports every metric as 0, meaning nothing is hidden).
 */
export function stepStripOverflow(metrics: StepStripScrollMetrics): StepStripOverflow {
    const { scrollLeft, scrollWidth, clientWidth } = metrics;
    if (!(scrollWidth > clientWidth + OVERFLOW_TOLERANCE_PX)) {
        return { left: false, right: false };
    }
    return {
        left: scrollLeft > OVERFLOW_TOLERANCE_PX,
        right: scrollLeft + clientWidth < scrollWidth - OVERFLOW_TOLERANCE_PX
    };
}

/** KNG-168: "Step 3 of 9 · Rotation" for the compact (narrow screen) header. */
export function compactStepLabel(steps: WizardStepProgressItem[]): string {
    if (steps.length === 0) {
        return '';
    }
    const currentIndex = Math.max(0, steps.findIndex(step => step.isCurrent));
    const name = steps[currentIndex].name?.trim() || '';
    const position = `Step ${currentIndex + 1} of ${steps.length}`;
    return name ? `${position} · ${name}` : position;
}

/**
 * Narrow screens: "Step 3 of 9 · Rotation" over a thin bar instead of the circles, which don't fit.
 */
const CompactStepHeader: React.FC<{ steps: WizardStepProgressItem[] }> = ({ steps }) => {
    const currentIndex = Math.max(0, steps.findIndex(step => step.isCurrent));
    const label = compactStepLabel(steps);
    const percent = steps.length > 0 ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0;
    return (
        <div data-testid="wizard-step-compact" className="sm:hidden px-1">
            <p className="truncate text-sm font-medium text-gray-700" title={label}>
                {label}
            </p>
            <div
                role="progressbar"
                aria-label="Form progress"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={currentIndex + 1}
                aria-valuetext={label}
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
            >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

/**
 * Numbered step circles with the step name under each one. Names are truncated (full name on
 * hover) and hidden below `md`, where only the numbers fit. KNG-168: a form with many steps
 * scrolls the strip sideways (the current step is kept in view, fades and ‹ › buttons show only on
 * a side that hides steps); below `sm` a compact "Step 3 of 9 · Name" header replaces the circles.
 */
export const WizardStepProgress: React.FC<{ steps: WizardStepProgressItem[] }> = ({ steps }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLOListElement>(null);
    const currentRef = useRef<HTMLLIElement>(null);
    const [overflow, setOverflow] = useState<StepStripOverflow>({ left: false, right: false });

    const updateOverflow = useCallback(() => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        const next = stepStripOverflow({
            scrollLeft: el.scrollLeft,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth
        });
        setOverflow(prev => (prev.left === next.left && prev.right === next.right ? prev : next));
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) {
            return undefined;
        }
        updateOverflow();
        el.addEventListener('scroll', updateOverflow, { passive: true });
        window.addEventListener('resize', updateOverflow);
        let observer: ResizeObserver | undefined;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => updateOverflow());
            observer.observe(el);
            if (listRef.current) {
                observer.observe(listRef.current);
            }
        }
        return () => {
            el.removeEventListener('scroll', updateOverflow);
            window.removeEventListener('resize', updateOverflow);
            observer?.disconnect();
        };
    }, [updateOverflow]);

    const currentIndex = steps.findIndex(step => step.isCurrent);

    // Keep the current step in view on every step change. Scrolls the strip itself rather than
    // calling scrollIntoView, so the page never jumps vertically.
    useEffect(() => {
        const el = scrollRef.current;
        const current = currentRef.current;
        if (el && current && el.scrollWidth > el.clientWidth) {
            const target = current.offsetLeft - (el.clientWidth - current.offsetWidth) / 2;
            const left = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
            if (typeof el.scrollTo === 'function') {
                el.scrollTo({ left, behavior: 'smooth' });
            } else {
                el.scrollLeft = left;
            }
        }
        updateOverflow();
    }, [currentIndex, steps.length, updateOverflow]);

    const scrollByPage = (direction: -1 | 1) => {
        const el = scrollRef.current;
        if (!el) {
            return;
        }
        const left = direction * Math.max(el.clientWidth * 0.75, 80);
        if (typeof el.scrollBy === 'function') {
            el.scrollBy({ left, behavior: 'smooth' });
        } else {
            el.scrollLeft += left;
        }
    };

    return (
        <div className="mx-auto mb-6 w-full max-w-3xl">
            <CompactStepHeader steps={steps} />
            <div data-testid="wizard-step-circles" className="relative hidden sm:block">
                <div
                    ref={scrollRef}
                    data-testid="wizard-step-strip"
                    className="relative overflow-x-auto snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <ol
                        ref={listRef}
                        aria-label="Form steps"
                        className="flex items-start justify-center w-max min-w-full px-2 md:px-4 gap-3 md:gap-4"
                    >
                        {steps.map((step, position) => {
                            const name = step.name?.trim() || '';
                            const label = name ? `Step ${position + 1}: ${name}` : `Step ${position + 1}`;
                            return (
                                <li
                                    key={step.key}
                                    ref={step.isCurrent ? currentRef : undefined}
                                    title={name || undefined}
                                    aria-label={label}
                                    aria-current={step.isCurrent ? 'step' : undefined}
                                    className="flex flex-shrink-0 items-start gap-2 md:gap-3 snap-center"
                                >
                                    <div className="flex flex-col items-center min-w-0">
                                        <div
                                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex flex-shrink-0 items-center justify-center text-sm font-semibold transition-colors ${
                                                step.isDone
                                                    ? 'bg-green-500 text-white'
                                                    : step.isCurrent
                                                    ? 'bg-primary text-white'
                                                    : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {step.isDone ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : position + 1}
                                        </div>
                                        {name && (
                                            <span
                                                data-testid="wizard-step-name"
                                                className={`hidden md:block mt-1 max-w-[7rem] truncate text-center text-xs ${
                                                    step.isCurrent ? 'font-semibold text-gray-900' : 'text-gray-500'
                                                }`}
                                            >
                                                {name}
                                            </span>
                                        )}
                                    </div>
                                    {position < steps.length - 1 && (
                                        <div
                                            aria-hidden="true"
                                            className={`mt-3.5 md:mt-[1.125rem] h-1 w-6 md:w-12 rounded-full transition-colors flex-shrink-0 ${
                                                step.isDone ? 'bg-green-500' : 'bg-gray-200'
                                            }`}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </div>
                {overflow.left && (
                    <>
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-gray-50 to-transparent"
                        />
                        <button
                            type="button"
                            onClick={() => scrollByPage(-1)}
                            aria-label="Show earlier steps"
                            title="Show earlier steps"
                            className="absolute left-0 top-0 md:top-1 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </>
                )}
                {overflow.right && (
                    <>
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-gray-50 to-transparent"
                        />
                        <button
                            type="button"
                            onClick={() => scrollByPage(1)}
                            aria-label="Show later steps"
                            title="Show later steps"
                            className="absolute right-0 top-0 md:top-1 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * The step name stays the title in edit mode too; "Edit {entity}" becomes a small heading above it.
 * A step without a name falls back to "Edit {entity}" as the title.
 */
export const WizardStepTitle: React.FC<{
    stepName?: string | null;
    description?: string | null;
    editingEntityName?: string | null;
}> = ({ stepName, description, editingEntityName }) => {
    const name = stepName?.trim() || '';
    const editLabel = editingEntityName ? `Edit ${editingEntityName}` : '';
    return (
        <div className="text-center mb-6">
            {editLabel && name && (
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{editLabel}</p>
            )}
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{name || editLabel}</h2>
            {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
        </div>
    );
};
