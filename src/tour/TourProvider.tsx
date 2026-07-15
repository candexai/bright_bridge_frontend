import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { driver, type Driver, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import api from '../api/axios';
import { TOUR_STEPS, getStepIndex, getPhaseProgress, type TourStep } from './steps';
import {
  clearSettingsSavedForTour,
  startSoftGatePoll,
} from './softGates';

export type ProductTourStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

interface ProductTourState {
  status: ProductTourStatus;
  currentStepId: string | null;
  skippedSteps: string[];
}

interface TourContextValue {
  active: boolean;
  stepIndex: number;
}

const TourContext = createContext<TourContextValue>({ active: false, stepIndex: -1 });

export function useProductTour() {
  return useContext(TourContext);
}

async function patchTour(payload: {
  status?: ProductTourStatus;
  currentStepId?: string | null;
  skippedSteps?: string[];
}) {
  const res = await api.patch('/school/product-tour', payload);
  return res.data as ProductTourState;
}

function waitForElement(selector: string, timeoutMs = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, 120);
  });
}

function waitForPath(pathname: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    if (window.location.pathname === pathname) {
      resolve();
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.location.pathname === pathname || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

function forceSettingsTab(tab: 'agent' | 'automation' = 'agent') {
  window.dispatchEvent(new CustomEvent('school-tour-force-settings-tab', { detail: tab }));
}

function getSchoolMainScroller(): HTMLElement | null {
  return document.querySelector('main.custom-scrollbar, main.overflow-y-auto');
}

/** Keep the spotlight aligned by freezing page scroll while the tour is open. */
function lockTourScroll() {
  document.documentElement.classList.add('school-tour-active');
  document.body.classList.add('school-tour-active');
  const main = getSchoolMainScroller();
  if (main) main.classList.add('school-tour-scroll-lock');
}

function unlockTourScroll() {
  document.documentElement.classList.remove('school-tour-active');
  document.body.classList.remove('school-tour-active');
  document.querySelectorAll('.school-tour-scroll-lock').forEach((el) => {
    el.classList.remove('school-tour-scroll-lock');
  });
}

function clearTourTargetStyles() {
  document.querySelectorAll('.school-tour-scrollable-target').forEach((node) => {
    const el = node as HTMLElement;
    el.classList.remove('school-tour-scrollable-target');
    el.style.removeProperty('max-height');
    el.style.removeProperty('overflow-y');
  });
}

/** Bring the top of a target into view (not the middle — important for tall sections like KB). */
function scrollTargetIntoMain(el: Element, align: 'start' | 'center' = 'start') {
  const main = getSchoolMainScroller();
  const padding = 20;
  if (!main) {
    el.scrollIntoView({
      block: align === 'start' ? 'start' : 'center',
      inline: 'nearest',
    });
    return;
  }
  const mainRect = main.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  if (align === 'start') {
    main.scrollTop += elRect.top - mainRect.top - padding;
  } else {
    main.scrollTop +=
      elRect.top - mainRect.top - (mainRect.height / 2 - elRect.height / 2);
  }
}

/**
 * For tall tour targets (Knowledge Base, etc.): pin the section to the top of the viewport
 * and make the section itself scrollable so users can browse content without moving the page.
 */
function prepareTourTarget(el: Element) {
  clearTourTargetStyles();
  const htmlEl = el as HTMLElement;

  scrollTargetIntoMain(htmlEl, 'start');

  const main = getSchoolMainScroller();
  const available = main
    ? Math.max(260, main.clientHeight - 56)
    : Math.max(260, Math.floor(window.innerHeight * 0.68));

  // Measure after aligning; tall sections become an inner scroller
  const naturalHeight = htmlEl.scrollHeight;
  if (naturalHeight > available + 24) {
    htmlEl.classList.add('school-tour-scrollable-target');
    htmlEl.style.maxHeight = `${Math.floor(available)}px`;
    htmlEl.style.overflowY = 'auto';
    htmlEl.scrollTop = 0;
    // Re-pin header after clamping height
    scrollTargetIntoMain(htmlEl, 'start');
  }
}

/** Keep spotlight sized to the highlighted section when forms expand (e.g. Human Transfer ON). */
function watchActiveElement(el: Element, refresh: () => void): () => void {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      requestAnimationFrame(refresh);
    });
  };

  const ro = new ResizeObserver(schedule);
  ro.observe(el);
  const mo = new MutationObserver(schedule);
  mo.observe(el, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'checked', 'hidden', 'open'],
  });
  el.addEventListener('change', schedule, true);
  el.addEventListener('input', schedule, true);

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    mo.disconnect();
    el.removeEventListener('change', schedule, true);
    el.removeEventListener('input', schedule, true);
  };
}

/** Block wheel / touch scroll while the tour is active (except inside the card). */
function attachScrollBlockers(onEscape?: () => void): () => void {
  const shouldAllow = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el?.closest) return false;
    // Tour card itself, or the highlighted form fields (soft-gate typing / small overflows)
    return Boolean(
      el.closest(
        '.school-tour-popover, .driver-popover, .driver-active-element, .school-tour-scrollable-target'
      )
    );
  };

  const onWheel = (e: WheelEvent) => {
    if (shouldAllow(e.target)) return;
    e.preventDefault();
  };

  const onTouchMove = (e: TouchEvent) => {
    if (shouldAllow(e.target)) return;
    e.preventDefault();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }
    const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (!keys.includes(e.key)) return;
    if (shouldAllow(e.target)) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
  };

  window.addEventListener('wheel', onWheel, { passive: false, capture: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  window.addEventListener('keydown', onKeyDown, { capture: true });

  return () => {
    window.removeEventListener('wheel', onWheel, true);
    window.removeEventListener('touchmove', onTouchMove, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };
}

function makeButton(
  label: string,
  className: string,
  onClick: () => void,
  opts?: { disabled?: boolean; trailingArrow?: boolean }
) {
  const btn = document.createElement('button');
  btn.type = 'button';
  // Avoid the "driver-popover" class prefix — driver.js swallows those clicks
  btn.className = className;
  btn.disabled = Boolean(opts?.disabled);

  if (opts?.trailingArrow) {
    btn.innerHTML = `<span>${label}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    btn.textContent = label;
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;
    onClick();
  });
  return btn;
}

const GUIDE_MARK_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.8 5.4L19 10.2l-5.2 1.8L12 17.4l-1.8-5.4L5 10.2l5.2-1.8L12 3z" fill="currentColor"/><path d="M18.5 15.2l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" fill="currentColor" opacity=".85"/></svg>`;

/** Make the tour card movable by dragging its header. */
function enablePopoverDrag(wrapper: HTMLElement, handle: HTMLElement) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select')) return;

    const rect = wrapper.getBoundingClientRect();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originLeft = rect.left;
    originTop = rect.top;

    wrapper.style.position = 'fixed';
    wrapper.style.left = `${originLeft}px`;
    wrapper.style.top = `${originTop}px`;
    wrapper.style.right = 'auto';
    wrapper.style.bottom = 'auto';
    wrapper.style.margin = '0';
    wrapper.style.transform = 'none';
    wrapper.classList.add('school-tour-dragging');

    const arrow = wrapper.querySelector('.driver-popover-arrow') as HTMLElement | null;
    if (arrow) arrow.style.display = 'none';

    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const pad = 10;
    const width = wrapper.offsetWidth;
    const height = wrapper.offsetHeight;
    const left = clamp(originLeft + (e.clientX - startX), pad, window.innerWidth - width - pad);
    const top = clamp(originTop + (e.clientY - startY), pad, window.innerHeight - height - pad);
    wrapper.style.left = `${left}px`;
    wrapper.style.top = `${top}px`;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    wrapper.classList.remove('school-tour-dragging');
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', onPointerUp);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);

  const driverRef = useRef<Driver | null>(null);
  const gateStopRef = useRef<(() => void) | null>(null);
  const scrollUnlockRef = useRef<(() => void) | null>(null);
  const highlightWatchRef = useRef<(() => void) | null>(null);
  const gateReadyRef = useRef(false);
  const stepIndexRef = useRef(-1);
  const runningRef = useRef(false);
  const skippedRef = useRef<string[]>([]);
  const showGenRef = useRef(0);
  const showStepRef = useRef<(index: number) => Promise<void>>(async () => {});
  const finishTourRef = useRef<(status: 'completed' | 'dismissed') => Promise<void>>(async () => {});

  const stopGateOnly = useCallback(() => {
    if (gateStopRef.current) {
      gateStopRef.current();
      gateStopRef.current = null;
    }
  }, []);

  const releaseScrollLock = useCallback(() => {
    if (scrollUnlockRef.current) {
      scrollUnlockRef.current();
      scrollUnlockRef.current = null;
    }
    unlockTourScroll();
    clearTourTargetStyles();
  }, []);

  const engageScrollLock = useCallback(() => {
    if (!scrollUnlockRef.current) {
      scrollUnlockRef.current = attachScrollBlockers(() => {
        void finishTourRef.current('dismissed');
      });
    }
    lockTourScroll();
  }, []);

  const stopHighlightWatch = useCallback(() => {
    if (highlightWatchRef.current) {
      highlightWatchRef.current();
      highlightWatchRef.current = null;
    }
  }, []);

  const destroyDriverOnly = useCallback(() => {
    stopHighlightWatch();
    if (driverRef.current) {
      try {
        driverRef.current.destroy();
      } catch {
        /* already destroyed */
      }
      driverRef.current = null;
    }
  }, [stopHighlightWatch]);

  const finishTour = useCallback(
    async (status: 'completed' | 'dismissed') => {
      runningRef.current = false;
      showGenRef.current += 1;
      stopGateOnly();
      destroyDriverOnly();
      releaseScrollLock();
      setActive(false);
      setStepIndex(-1);
      stepIndexRef.current = -1;
      clearSettingsSavedForTour();
      try {
        await patchTour({ status, currentStepId: null });
      } catch (err) {
        console.error('Failed to persist product tour finish:', err);
      }
      if (status === 'completed') {
        const toast = document.createElement('div');
        toast.setAttribute('role', 'status');
        toast.className = 'school-tour-toast';
        toast.textContent = "You're all set — the portal tour is complete.";
        document.body.appendChild(toast);
        window.setTimeout(() => toast.remove(), 4000);
      }
    },
    [destroyDriverOnly, releaseScrollLock, stopGateOnly]
  );

  useEffect(() => {
    finishTourRef.current = finishTour;
  }, [finishTour]);

  const persistProgress = useCallback(async (index: number, skipped?: string[]) => {
    const step = TOUR_STEPS[index];
    if (!step) return;
    try {
      await patchTour({
        status: 'in_progress',
        currentStepId: step.id,
        ...(skipped ? { skippedSteps: skipped } : {}),
      });
      if (skipped) skippedRef.current = skipped;
    } catch (err) {
      console.error('Failed to persist product tour progress:', err);
    }
  }, []);

  const goNext = useCallback(
    async (index: number) => {
      const next = index + 1;
      if (next >= TOUR_STEPS.length) {
        await finishTour('completed');
        return;
      }
      await persistProgress(next);
      await showStepRef.current(next);
    },
    [finishTour, persistProgress]
  );

  const goSkip = useCallback(
    async (index: number, stepId: string) => {
      const skipped = skippedRef.current.includes(stepId)
        ? skippedRef.current
        : [...skippedRef.current, stepId];
      const next = index + 1;
      if (next >= TOUR_STEPS.length) {
        await finishTour('completed');
        return;
      }
      await persistProgress(next, skipped);
      await showStepRef.current(next);
    },
    [finishTour, persistProgress]
  );

  const renderPopoverChrome = useCallback(
    (
      step: TourStep,
      index: number,
      gateReady: boolean,
      handlers: {
        onPrimary: () => void;
        onSkip: () => void;
        onEnd: () => void;
      }
    ) => {
      return (popover: PopoverDOM) => {
        popover.footer.style.display = 'none';
        popover.closeButton.style.display = 'none';
        popover.previousButton.style.display = 'none';
        popover.nextButton.style.display = 'none';
        popover.progress.style.display = 'none';

        popover.wrapper.querySelectorAll('.school-tour-header, .school-tour-chrome, .school-tour-progress, .school-tour-gate-hint').forEach((n) => n.remove());

        const phase = getPhaseProgress(index);
        const overallPct = ((index + 1) / TOUR_STEPS.length) * 100;

        const header = document.createElement('div');
        header.className = 'school-tour-header';
        header.title = 'Drag to move';
        header.innerHTML = `
          <div class="school-tour-drag-grip" aria-hidden="true">
            <span></span><span></span>
          </div>
          <div class="school-tour-brand">
            <div class="school-tour-mark">${GUIDE_MARK_SVG}</div>
            <div class="school-tour-brand-copy">
              <strong>BrightBridge Guide</strong>
              <span>Drag header to move · setup walkthrough</span>
            </div>
          </div>
          <div class="school-tour-phase-pill">${phase.label}</div>
        `;
        popover.wrapper.insertBefore(header, popover.wrapper.firstChild);
        enablePopoverDrag(popover.wrapper, header);

        const progress = document.createElement('div');
        progress.className = 'school-tour-progress';
        progress.innerHTML = `
          <div class="school-tour-progress-meta">
            <span>${phase.label} · ${phase.current} of ${phase.total}</span>
            <strong>${index + 1} / ${TOUR_STEPS.length}</strong>
          </div>
          <div class="school-tour-progress-bar"><i style="width:${overallPct}%"></i></div>
        `;
        // Place progress between description and chrome
        if (popover.description.nextSibling) {
          popover.wrapper.insertBefore(progress, popover.description.nextSibling);
        } else {
          popover.wrapper.appendChild(progress);
        }

        if (step.waitFor) {
          const hint = document.createElement('div');
          hint.className = gateReady
            ? 'school-tour-gate-hint school-tour-gate-ready'
            : 'school-tour-gate-hint';
          hint.textContent = gateReady
            ? step.waitFor === 'integrations'
              ? 'Account connected — continue when ready.'
              : 'Settings saved — continue when ready.'
            : step.waitFor === 'integrations'
              ? 'Connect Google or Outlook below, then continue — or skip for now.'
              : 'Save your school details or knowledge base, then continue — or skip for now.';
          progress.insertAdjacentElement('afterend', hint);
        }

        const chrome = document.createElement('div');
        chrome.className = 'school-tour-chrome';

        const actions = document.createElement('div');
        actions.className = 'school-tour-actions';

        const left = document.createElement('div');
        left.className = 'school-tour-actions-left';
        left.appendChild(
          makeButton('End tour', 'school-tour-btn school-tour-btn-ghost', handlers.onEnd)
        );
        actions.appendChild(left);

        const right = document.createElement('div');
        right.className = 'school-tour-actions-right';

        if (step.showDoLater) {
          right.appendChild(
            makeButton("I'll do this on my own", 'school-tour-btn school-tour-btn-text', handlers.onSkip)
          );
        }

        const primaryLabel =
          step.primaryLabel || (index === TOUR_STEPS.length - 1 ? 'Finish' : 'Next');
        const isLast = index === TOUR_STEPS.length - 1;
        right.appendChild(
          makeButton(
            primaryLabel,
            'school-tour-btn school-tour-btn-primary',
            () => {
              handlers.onPrimary();
            },
            {
              // Soft gates never block Continue — Skip / Next always work
              disabled: false,
              trailingArrow: !isLast,
            }
          )
        );

        actions.appendChild(right);
        chrome.appendChild(actions);
        popover.wrapper.appendChild(chrome);
      };
    },
    []
  );

  const showStep = useCallback(
    async (index: number) => {
      if (!runningRef.current) return;
      const gen = ++showGenRef.current;
      const step = TOUR_STEPS[index];
      if (!step) {
        await finishTour('completed');
        return;
      }

      stopGateOnly();
      destroyDriverOnly();
      stepIndexRef.current = index;
      setStepIndex(index);
      setActive(true);
      gateReadyRef.current = !step.waitFor;

      if (window.location.pathname !== step.route) {
        navigate(step.route);
        await waitForPath(step.route);
      }
      if (!runningRef.current || showGenRef.current !== gen) return;

      if (step.route === '/school/settings') {
        forceSettingsTab(step.settingsTab || 'agent');
      }

      if (step.element) {
        await waitForElement(step.element);
        if (step.route === '/school/settings') {
          forceSettingsTab(step.settingsTab || 'agent');
          await waitForElement(step.element);
        }
        const el = document.querySelector(step.element);
        if (el) {
          prepareTourTarget(el);
        }
        // Let layout settle after scroll/clamp, then freeze page scroll
        await new Promise((r) => setTimeout(r, 100));
      } else {
        clearTourTargetStyles();
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!runningRef.current || showGenRef.current !== gen) return;

      engageScrollLock();

      await persistProgress(index);
      if (!runningRef.current || showGenRef.current !== gen) return;

      const paint = (gateReady: boolean) => {
        if (!runningRef.current || showGenRef.current !== gen) return;
        destroyDriverOnly();

        const handlers = {
          onPrimary: () => {
            void goNext(index);
          },
          onSkip: () => {
            void goSkip(index, step.id);
          },
          onEnd: () => {
            void finishTour('dismissed');
          },
        };

        const d = driver({
          animate: true,
          overlayOpacity: 0.48,
          stagePadding: 12,
          stageRadius: 14,
          allowClose: false,
          disableActiveInteraction: false,
          popoverClass: 'school-tour-popover',
          showButtons: ['next'],
          onPopoverRender: renderPopoverChrome(step, index, gateReady, handlers),
        });
        driverRef.current = d;

        const popover = {
          title: step.title,
          description: step.description,
          side: step.side || ('bottom' as const),
          align: step.align || ('start' as const),
          popoverClass: 'school-tour-popover',
          showButtons: ['next'] as ['next'],
          onNextClick: () => handlers.onPrimary(),
          onPopoverRender: renderPopoverChrome(step, index, gateReady, handlers),
        };

        if (step.element) {
          const el = document.querySelector(step.element);
          if (el) {
            d.highlight({ element: el, popover });
            highlightWatchRef.current = watchActiveElement(el, () => {
              if (!runningRef.current || showGenRef.current !== gen) return;
              if (driverRef.current !== d) return;

              // Keep spotlight resized when the section expands (e.g. Human Transfer ON).
              // Do not re-scroll the page — the user may be browsing inside a tall target.
              try {
                d.refresh();
              } catch {
                /* driver destroyed mid-refresh */
              }
            });
          } else {
            d.highlight({ popover });
          }
        } else {
          d.highlight({ popover });
        }
      };

      paint(gateReadyRef.current);

      if (step.waitFor) {
        stopGateOnly();
        gateStopRef.current = startSoftGatePoll(step.waitFor, () => {
          if (!runningRef.current || showGenRef.current !== gen) return;
          if (gateReadyRef.current) return;
          gateReadyRef.current = true;
          paint(true);
        });
      }
    },
    [
      destroyDriverOnly,
      engageScrollLock,
      finishTour,
      goNext,
      goSkip,
      navigate,
      persistProgress,
      renderPopoverChrome,
      stopGateOnly,
    ]
  );

  useEffect(() => {
    showStepRef.current = showStep;
  }, [showStep]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const res = await api.get('/school/product-tour');
        if (cancelled) return;
        const state = res.data as ProductTourState;
        if (state.status !== 'pending' && state.status !== 'in_progress') return;

        skippedRef.current = Array.isArray(state.skippedSteps) ? state.skippedSteps : [];

        // Old soft-gate step removed — migrate persisted progress so the user isn't stuck
        let stepId = state.currentStepId;
        if (stepId === 'settings-save') {
          stepId = 'settings-kb';
          try {
            await patchTour({
              status: 'in_progress',
              currentStepId: 'settings-kb',
            });
          } catch {
            /* continue locally even if patch fails */
          }
        }

        runningRef.current = true;
        await new Promise((r) => setTimeout(r, 350));
        if (cancelled || !runningRef.current) return;
        await showStep(getStepIndex(stepId));
      } catch (err) {
        console.error('Failed to load product tour:', err);
      }
    };

    void boot();

    // Vite HMR: restart tour engine when tour modules change so users aren't stuck on old steps
    const hot = (import.meta as ImportMeta & { hot?: { accept: (cb?: () => void) => void } }).hot;
    if (hot) {
      hot.accept(() => {
        if (cancelled) return;
        destroyDriverOnly();
        releaseScrollLock();
        runningRef.current = false;
        void boot();
      });
    }

    return () => {
      cancelled = true;
      runningRef.current = false;
      stopGateOnly();
      destroyDriverOnly();
      releaseScrollLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TourContext.Provider value={{ active, stepIndex }}>{children}</TourContext.Provider>
  );
}
