"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconBuildingSkyscraper,
  IconArrowRight,
  IconBolt,
  IconTag,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  getPriceDisplayInfo,
  intervalToggleLabel,
} from "@/lib/pricing";

export default function LandingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<string>("MONTH");
  const [availableIntervals, setAvailableIntervals] = useState<string[]>([
    "MONTH",
  ]);
  const [expandedPlans, setExpandedPlans] = useState<
    Record<string, boolean>
  >({});
  const [activeIndex, setActiveIndex] = useState(-1);

  const hasFetched = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (planId: string) => {
    setExpandedPlans((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    // Infinite carousel
    if (plans.length > 3 && activeIndex !== -1) {
      const container = scrollRef.current;

      const nextIndex =
        direction === "right" ? activeIndex + 1 : activeIndex - 1;

      const totalItems = plans.length * 3;

      // Keep index within bounds
      if (nextIndex < 0 || nextIndex >= totalItems) return;

      setActiveIndex(nextIndex);

      const child = container.children[nextIndex] as HTMLElement;

      if (child) {
        const containerRect = container.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();

        const targetScroll =
          container.scrollLeft +
          (childRect.left - containerRect.left) -
          (containerRect.width - childRect.width) / 2;

        container.scrollTo({
          left: targetScroll,
          behavior: "smooth",
        });
      }

      // Reset back to the middle set after reaching either end
      setTimeout(() => {
        if (!scrollRef.current) return;

        let resetIndex = nextIndex;
        let needsReset = false;

        if (nextIndex >= plans.length * 2) {
          resetIndex = nextIndex - plans.length;
          needsReset = true;
        } else if (nextIndex < plans.length) {
          resetIndex = nextIndex + plans.length;
          needsReset = true;
        }

        if (needsReset) {
          setActiveIndex(resetIndex);

          const resetChild = scrollRef.current.children[
            resetIndex
          ] as HTMLElement;

          if (resetChild) {
            const containerRect =
              scrollRef.current.getBoundingClientRect();

            const childRect = resetChild.getBoundingClientRect();

            const targetScroll =
              scrollRef.current.scrollLeft +
              (childRect.left - containerRect.left) -
              (containerRect.width - childRect.width) / 2;

            scrollRef.current.scrollTo({
              left: targetScroll,
              behavior: "auto",
            });
          }
        }
      }, 550);
    } else {
      // Normal scrolling for <= 3 plans
      const { scrollLeft, clientWidth } = scrollRef.current;

      const scrollAmount =
        direction === "left" ? scrollLeft - clientWidth : scrollLeft + clientWidth;

      scrollRef.current.scrollTo({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  /*
   * Center default plan on initial load
   */
  useEffect(() => {
    if (
      plans.length > 0 &&
      scrollRef.current &&
      activeIndex === -1
    ) {
      const defaultIdx = plans.findIndex((p) => p.isDefault);

      const targetIdx = defaultIdx !== -1 ? defaultIdx : 0;

      // Put carousel on the middle copy
      const absoluteIdx =
        plans.length > 3
          ? plans.length + targetIdx
          : targetIdx;

      setActiveIndex(absoluteIdx);

      setTimeout(() => {
        const container = scrollRef.current;

        if (!container) return;

        const child = container.children[
          absoluteIdx
        ] as HTMLElement;

        if (child) {
          const containerRect =
            container.getBoundingClientRect();

          const childRect =
            child.getBoundingClientRect();

          const targetScroll =
            container.scrollLeft +
            (childRect.left - containerRect.left) -
            (containerRect.width - childRect.width) / 2;

          container.scrollTo({
            left: targetScroll,
            behavior: "auto",
          });
        }
      }, 100);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  /*
   * Auto-scroll every 5 seconds.
   *
   * IMPORTANT:
   * Only depend on plans.length.
   * We don't want a new interval every time activeIndex changes.
   */
  useEffect(() => {
    if (plans.length <= 3) return;

    const interval = setInterval(() => {
      scroll("right");
    }, 5000);

    return () => clearInterval(interval);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans.length]);

  /*
   * Fetch plans
   */
  useEffect(() => {
    if (hasFetched.current) return;

    hasFetched.current = true;

    async function fetchPlans() {
      try {
        const [plansRes, intervalsRes] = await Promise.all([
          fetch("/api/public/plans"),
          fetch("/api/public/intervals"),
        ]);

        if (plansRes.ok && intervalsRes.ok) {
          const plansResponse = await plansRes.json();
          const intervalsResponse = await intervalsRes.json();

          let plansArray = plansResponse.plans ?? [];

          /*
           * If there are exactly 3 plans,
           * force the default plan into the middle.
           */
          if (plansArray.length === 3) {
            const defaultPlanIndex = plansArray.findIndex(
              (p: any) => p.isDefault
            );

            if (
              defaultPlanIndex !== -1 &&
              defaultPlanIndex !== 1
            ) {
              const defaultPlan = plansArray.splice(
                defaultPlanIndex,
                1
              )[0];

              plansArray.splice(1, 0, defaultPlan);
            }
          }

          setPlans(plansArray);

          /*
           * Get actual DB interval order
           */
          const dbIntervals =
            intervalsResponse.data || [];

          /*
           * Determine available intervals from prices
           */
          const intervalsSet = new Set<string>();

          plansArray.forEach((plan: any) => {
            plan.prices?.forEach((price: any) => {
              if (price.billingInterval) {
                intervalsSet.add(price.billingInterval);
              }
            });
          });

          /*
           * Sort according to DB enum order
           */
          const sorted = dbIntervals.filter(
            (interval: string) =>
              intervalsSet.has(interval)
          );

          if (sorted.length > 0) {
            setAvailableIntervals(sorted);
            setBillingInterval(sorted[0]);
          }
        }
      } catch (err) {
        console.error(
          "Failed to fetch public plans:",
          err
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  /*
   * Create 3 copies for infinite carousel.
   */
  const infinitePlans =
    plans.length > 3
      ? [...plans, ...plans, ...plans]
      : plans;

  return (
    <div
      className="
        min-h-screen
        w-full
        bg-nexus-bg
        text-nexus-text
        font-sans
        selection:bg-nexus-primary/30
        overflow-x-clip
      "
    >
      {/* Navigation */}
      <nav
        className="
          border-b
          border-[#151B2C]
          bg-nexus-bg/80
          backdrop-blur-md
          sticky
          top-0
          z-50
        "
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div
                className="
                  w-8
                  h-8
                  rounded-lg
                  bg-nexus-primary/10
                  border
                  border-nexus-primary/20
                  text-nexus-primary
                  flex
                  items-center
                  justify-center
                "
              >
                <IconBuildingSkyscraper size={20} />
              </div>

              <span className="text-xl font-extrabold tracking-tight">
                Infinity Vibez
              </span>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="
                  text-sm
                  font-medium
                  text-nexus-text-secondary
                  hover:text-white
                  transition-colors
                "
              >
                Login
              </Link>

              <Link
                href="/signup"
                className="
                  text-sm
                  font-semibold
                  bg-nexus-primary
                  text-white
                  px-4
                  py-2
                  rounded-lg
                  hover:bg-nexus-primary/90
                  transition-colors
                  shadow-lg
                  shadow-nexus-primary/20
                "
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main
        className="
          max-w-7xl
          mx-auto
          px-4
          sm:px-6
          lg:px-8
          py-16
          sm:py-20
          lg:py-32
          flex
          flex-col
          items-center
          text-center
        "
      >
        {/* Badge */}
        <div
          className="
            inline-flex
            items-center
            gap-2
            px-3
            py-1
            rounded-full
            bg-nexus-primary/10
            text-nexus-primary
            text-xs
            font-semibold
            uppercase
            tracking-wider
            mb-8
            border
            border-nexus-primary/20
          "
        >
          <IconBolt size={14} />
          The future of CRM
        </div>

        {/* Heading */}
        <h1
          className="
            text-4xl
            sm:text-5xl
            lg:text-7xl
            font-extrabold
            tracking-tighter
            text-transparent
            bg-clip-text
            bg-gradient-to-r
            from-white
            to-nexus-text-secondary
            mb-6
            leading-tight
          "
        >
          Supercharge your
          <br />
          sales pipeline.
        </h1>

        {/* Description */}
        <p
          className="
            text-base
            sm:text-lg
            lg:text-xl
            text-nexus-text-secondary
            max-w-2xl
            mb-10
          "
        >
          Infinity Vibez is the modern CRM platform
          designed for high-performing sales teams.
          Manage leads, track deals, and close more
          revenue.
        </p>

        {/* Plans Section */}
        <div
          className="w-full mt-12 sm:mt-16"
          id="pricing"
        >
          <h2 className="text-3xl font-bold mb-3">
            Choose your plan
          </h2>

          <p className="text-nexus-text-secondary mb-10">
            No hidden fees. Switch anytime.
          </p>

          {/* Billing Toggle */}
          {!loading &&
            availableIntervals.length > 1 && (
              <div className="flex justify-center mb-12">
                <div
                  className="
                    bg-[#151B2C]
                    p-1
                    rounded-xl
                    inline-flex
                    gap-0.5
                    max-w-full
                    overflow-x-auto
                  "
                >
                  {availableIntervals.map(
                    (interval) => (
                      <button
                        key={interval}
                        onClick={() =>
                          setBillingInterval(interval)
                        }
                        className={`
                          px-6
                          py-2
                          rounded-lg
                          text-sm
                          font-semibold
                          transition-all
                          whitespace-nowrap
                          ${billingInterval === interval
                            ? "bg-nexus-primary text-white shadow-md"
                            : "text-nexus-text-secondary hover:text-white"
                          }
                        `}
                      >
                        {intervalToggleLabel(interval)}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Loading */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div
                className="
                  w-8
                  h-8
                  border-2
                  border-nexus-primary
                  border-t-transparent
                  rounded-full
                  animate-spin
                "
              />
            </div>
          ) : (
            <div className="relative w-full">
              {/* Previous Button */}
              {plans.length > 3 && (
                <>
                  <button
                    onClick={() => scroll("left")}
                    className="
                      absolute
                      -left-2
                      sm:-left-4
                      md:-left-10
                      top-1/2
                      -translate-y-1/2
                      z-10
                      w-10
                      h-10
                      sm:w-12
                      sm:h-12
                      bg-nexus-card
                      border
                      border-nexus-border
                      rounded-full
                      flex
                      items-center
                      justify-center
                      text-nexus-text
                      shadow-xl
                      transition-all
                      hover:bg-nexus-primary
                      hover:text-black
                      focus:opacity-100
                    "
                    aria-label="Previous plans"
                  >
                    <IconChevronLeft size={22} />
                  </button>

                  {/* Next Button */}
                  <button
                    onClick={() => scroll("right")}
                    className="
                      absolute
                      -right-2
                      sm:-right-4
                      md:-right-10
                      top-1/2
                      -translate-y-1/2
                      z-10
                      w-10
                      h-10
                      sm:w-12
                      sm:h-12
                      bg-nexus-card
                      border
                      border-nexus-border
                      rounded-full
                      flex
                      items-center
                      justify-center
                      text-nexus-text
                      shadow-xl
                      transition-all
                      hover:bg-nexus-primary
                      hover:text-black
                      focus:opacity-100
                    "
                    aria-label="Next plans"
                  >
                    <IconChevronRight size={22} />
                  </button>
                </>
              )}

              {/* Plans Container */}
              <div
                ref={scrollRef}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
                className={
                  plans.length > 3
                    ? `
                      relative
                      flex
                      overflow-x-auto
                      overflow-y-hidden
                      overscroll-x-contain
                      snap-x
                      snap-mandatory
                      items-stretch
                      gap-5
                      sm:gap-8
                      pb-8
                      pt-4
                      px-4
                      -mx-4
                      [&::-webkit-scrollbar]:hidden
                    `
                    : `
                      relative
                      grid
                      grid-cols-1
                      md:grid-cols-2
                      lg:grid-cols-3
                      gap-8
                      items-stretch
                      text-left
                    `
                }
              >
                {infinitePlans.map(
                  (plan, idx) => {
                    /*
                     * SOURCE OF TRUTH:
                     * activePrice comes from plan.prices[]
                     */
                    const activePrice =
                      plan.prices?.find(
                        (p: any) =>
                          p.billingInterval ===
                          billingInterval &&
                          p.isActive
                      ) ||
                      plan.prices?.find(
                        (p: any) =>
                          p.billingInterval ===
                          billingInterval
                      ) ||
                      plan.prices?.[0];

                    if (!activePrice) return null;

                    const priceInfo =
                      getPriceDisplayInfo(activePrice);

                    const isCentered =
                      plans.length > 3
                        ? idx === activeIndex
                        : plan.isDefault;

                    return (
                      <div
                        key={`${plan.id}-${idx}`}
                        className={
                          plans.length > 3
                            ? `
                              bg-[#0B0F19]
                              border
                              border-[#151B2C]
                              rounded-2xl
                              p-6
                              sm:p-8
                              shadow-xl
                              flex
                              flex-col
                              relative
                              overflow-hidden
                              group
                              hover:border-nexus-primary/40
                              transition-colors
                              shrink-0
                              w-[calc(100vw-3rem)]
                              sm:w-[calc(100vw-2rem)]
                              md:w-[calc(50%-1rem)]
                              lg:w-[calc(33.333%-1.33rem)]
                              snap-center
                              text-left
                            `
                            : `
                              bg-[#0B0F19]
                              border
                              border-[#151B2C]
                              rounded-2xl
                              p-6
                              sm:p-8
                              shadow-xl
                              flex
                              flex-col
                              relative
                              overflow-hidden
                              group
                              hover:border-nexus-primary/40
                              transition-colors
                              text-left
                            `
                        }
                      >
                        {/* Active Plan Top Border */}
                        {isCentered && (
                          <div
                            className="
                              absolute
                              top-0
                              inset-x-0
                              h-1
                              bg-gradient-to-r
                              from-nexus-primary
                              to-blue-500
                            "
                          />
                        )}

                        {/* Savings Badge */}
                        {priceInfo.hasDiscount &&
                          priceInfo.savingsPercent !==
                          null && (
                            <div
                              className="
                                absolute
                                top-4
                                right-4
                                flex
                                items-center
                                gap-1
                                bg-green-500/15
                                border
                                border-green-500/25
                                text-green-400
                                text-xs
                                font-bold
                                px-2.5
                                py-1
                                rounded-full
                              "
                            >
                              <IconTag size={12} />
                              Save{" "}
                              {priceInfo.savingsPercent}%
                            </div>
                          )}

                        {/* Plan Name */}
                        <h3 className="text-xl font-bold text-white mb-2 pr-20">
                          {plan.name}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-nexus-text-secondary min-h-10">
                          {plan.description}
                        </p>

                        {/* Price */}
                        <div className="my-6 space-y-1">
                          {/* Original Price */}
                          {priceInfo.hasDiscount &&
                            priceInfo.formattedOriginalAmount && (
                              <div
                                className="
                                  text-nexus-text-secondary
                                  text-base
                                  line-through
                                  decoration-red-400/70
                                "
                              >
                                {
                                  priceInfo.formattedOriginalAmount
                                }
                              </div>
                            )}

                          {/* Current Price */}
                          <div className="flex items-end gap-1.5">
                            <span
                              className="
                                text-3xl
                                sm:text-4xl
                                font-extrabold
                                text-white
                              "
                            >
                              {
                                priceInfo.formattedAmount
                              }
                            </span>

                            <span
                              className="
                                text-nexus-text-secondary
                                text-sm
                                mb-1.5
                                whitespace-nowrap
                              "
                            >
                              /{" "}
                              {priceInfo.intervalLabel}
                            </span>
                          </div>
                        </div>

                        {/* CTA */}
                        <Link
                          href={`/signup?planId=${plan.id}&planPriceId=${activePrice.id}`}
                          className={`
                            w-full
                            py-3
                            rounded-xl
                            font-semibold
                            flex
                            items-center
                            justify-center
                            gap-2
                            transition-all
                            ${isCentered
                              ? "bg-nexus-primary text-white hover:bg-nexus-primary/90 shadow-lg shadow-nexus-primary/20"
                              : "bg-[#151B2C] text-white hover:bg-[#1A2235]"
                            }
                          `}
                        >
                          Get Started
                          <IconArrowRight size={18} />
                        </Link>

                        {/* Features */}
                        <div className="mt-8 space-y-4 flex-1">
                          <p
                            className="
                              text-xs
                              font-semibold
                              text-nexus-text-secondary
                              uppercase
                              tracking-wider
                            "
                          >
                            Features included:
                          </p>

                          {(
                            expandedPlans[plan.id]
                              ? plan.features
                              : plan.features?.slice(0, 6)
                          )?.map((pf: any) => (
                            <div
                              key={pf.id}
                              className="
                                flex
                                items-start
                                gap-3
                                transition-all
                                duration-300
                              "
                            >
                              <IconCheck
                                size={18}
                                className="
                                  text-nexus-primary
                                  shrink-0
                                  mt-0.5
                                "
                              />

                              <span className="text-sm text-nexus-text">
                                {pf.feature?.name}
                              </span>
                            </div>
                          ))}

                          {/* Show More */}
                          {plan.features &&
                            plan.features.length > 6 && (
                              <button
                                onClick={() =>
                                  toggleExpand(
                                    plan.id
                                  )
                                }
                                className="
                                  text-nexus-primary
                                  text-sm
                                  font-medium
                                  hover:underline
                                  pt-2
                                  flex
                                  items-center
                                  focus:outline-none
                                "
                              >
                                {expandedPlans[
                                  plan.id
                                ]
                                  ? "Show less"
                                  : `+${plan.features
                                    .length - 6
                                  } more features`}
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="
          border-t
          border-[#151B2C]
          py-8
          text-center
          text-sm
          text-nexus-text-secondary
          mt-20
        "
      >
        &copy; {new Date().getFullYear()} Infinity Vibez.
        All rights reserved.
      </footer>
    </div>
  );
}
