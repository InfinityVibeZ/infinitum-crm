"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAddressBook,
  IconChartBar,
  IconRobot,
  IconSettings,
  IconChevronDown,
  IconChevronUp,
  IconLogout,
  IconUsers,
  IconUserShield,
  IconBuildingCommunity,
  IconTool,
  IconKey,
  IconMessage,
  IconCrown,
  IconInfinity,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";

import { useSidebarStore } from "@/store/sidebar";
import { useAuthStore } from "@/store/auth";
import { DEFAULT_PAGE_PERMISSIONS as DEFAULT_PERMISSIONS } from "@/lib/permissions";

interface MenuItem {
  label: string;
  href: string;
}

interface MenuSection {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-based menu definitions
// ─────────────────────────────────────────────────────────────────────────────

function getSuperAdminMenu(): MenuSection[] {
  return [
    {
      label: "PLATFORM",
      icon: <IconBuildingCommunity size={18} />,
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Organizations", href: "/admin/organizations" },
        { label: "Plans", href: "/admin/plans" },
        { label: "Features", href: "/admin/features" },
        { label: "Entitlements", href: "/admin/entitlements" },
        { label: "Usage", href: "/admin/usage" },
        { label: "Billing", href: "/admin/billing" },
        { label: "Audit Logs", href: "/admin/audit-logs" },
        { label: "Meta Integration", href: "/admin/integrations/meta" },
      ],
    },
    {
      label: "USER MANAGEMENT",
      icon: <IconUsers size={18} />,
      items: [
        {
          label: "User Management",
          href: "/admin/user-management",
        },
      ],
    },
    {
      label: "SYSTEM",
      icon: <IconTool size={18} />,
      items: [
        {
          label: "Menu Permissions",
          href: "/admin/permissions",
        },
        {
          label: "API Keys",
          href: "/settings/api-keys",
        },
      ],
    },
  ];
}

function getAdminMenu(): MenuSection[] {
  return [
    {
      label: "LEADS & CONTACTS",
      icon: <IconAddressBook size={18} />,
      items: [
        {
          label: "Leads",
          href: "/leads/crm",
        },
        {
          label: "Contacts",
          href: "/contacts",
        },
      ],
    },
    {
      label: "ACQUISITION",
      icon: <IconChartBar size={18} />,
      items: [
        {
          label: "Integrations",
          href: "/settings/integrations",
        },
        {
          label: "Attribution",
          href: "/attribution",
        },
      ],
    },
    {
      label: "AUTOMATION",
      icon: <IconRobot size={18} />,
      items: [
        {
          label: "Assignment Rules",
          href: "/settings/assignment-rules",
        },
      ],
    },
    {
      label: "ORGANIZATION",
      icon: <IconUsers size={18} />,
      items: [
        {
          label: "Users",
          href: "/admin/user-management",
        },
        {
          label: "Teams",
          href: "/settings/team",
        },
        {
          label: "Subscription",
          href: "/settings/subscription",
        },
      ],
    },
    {
      label: "INBOX",
      icon: <IconMessage size={18} />,
      items: [
        {
          label: "Inbox",
          href: "/inbox",
        },
      ],
    },
    {
      label: "SETTINGS",
      icon: <IconSettings size={18} />,
      items: [
        {
          label: "My Profile",
          href: "/settings/profile",
        },
      ],
    },
  ];
}

function getUserMenu(): MenuSection[] {
  return [
    {
      label: "LEADS & CONTACTS",
      icon: <IconAddressBook size={18} />,
      items: [
        {
          label: "My Leads",
          href: "/leads/crm",
        },
        {
          label: "Contacts",
          href: "/contacts",
        },
      ],
    },
    {
      label: "INBOX",
      icon: <IconMessage size={18} />,
      items: [
        {
          label: "Inbox",
          href: "/inbox",
        },
      ],
    },
    {
      label: "SETTINGS",
      icon: <IconSettings size={18} />,
      items: [
        {
          label: "My Profile",
          href: "/settings/profile",
        },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Role badge
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<
  string,
  {
    label: string;
    color: string;
  }
> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    color:
      "text-red-400 bg-red-500/15 border-red-500/30",
  },
  ADMIN: {
    label: "Admin",
    color:
      "text-orange-400 bg-orange-500/15 border-orange-500/30",
  },
  USER: {
    label: "User",
    color:
      "text-blue-400 bg-blue-500/15 border-blue-500/30",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

export function Sidebar({
  onClose,
  permissions,
}: {
  onClose?: () => void;
  permissions?: Record<string, boolean>;
} = {}) {
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);

  const {
    expandedSections,
    toggleSection,
    setExclusiveSection,
    isCollapsed,
    toggleCollapsed,
  } = useSidebarStore();

  const { user, logout } = useAuthStore();

  // Currently opened flyout section.
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);

  // Reference to the actual clicked parent buttons.
  const sectionButtonRefs = useRef<
    Record<string, HTMLButtonElement | null>
  >({});

  // Reference to the floating submenu.
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  // Floating submenu position.
  const [flyoutPos, setFlyoutPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Mounted state
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Position flyout
  //
  // IMPORTANT:
  // The flyout top is based directly on the clicked parent button's
  // getBoundingClientRect().top.
  //
  // There is NO hardcoded 230px offset.
  // ───────────────────────────────────────────────────────────────────────────

  const positionFlyout = (sectionLabel: string) => {
    const button = sectionButtonRefs.current[sectionLabel];

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();

    const sidebarWidth = 64;
    const gap = 8;

    const flyoutLeft = sidebarWidth + gap;

    // Start exactly at the same vertical position as the parent.
    let top = rect.top;

    // If the flyout would extend below the viewport,
    // move it upward only as much as necessary.
    const estimatedFlyoutHeight =
      Math.min(
        menuSectionsRef.current.find(
          (section) => section.label === sectionLabel
        )?.items.length ?? 1,
        12
      ) *
      38 +
      45;

    const bottomPadding = 12;

    if (
      top + estimatedFlyoutHeight >
      window.innerHeight - bottomPadding
    ) {
      top =
        window.innerHeight -
        estimatedFlyoutHeight -
        bottomPadding;
    }

    // Never allow it to go above the viewport.
    top = Math.max(8, top);

    setFlyoutPos({
      top,
      left: flyoutLeft,
    });
  };

  // Keep latest menu sections available to positionFlyout.
  const menuSectionsRef = useRef<MenuSection[]>([]);

  // ───────────────────────────────────────────────────────────────────────────
  // Open flyout
  // ───────────────────────────────────────────────────────────────────────────

  const openFlyoutFor = (
    sectionLabel: string,
    items: MenuItem[]
  ) => {
    if (openFlyout === sectionLabel) {
      setOpenFlyout(null);
      setFlyoutPos(null);
      return;
    }

    setOpenFlyout(sectionLabel);

    // Wait until React has rendered the flyout.
    requestAnimationFrame(() => {
      positionFlyout(sectionLabel);

      requestAnimationFrame(() => {
        positionFlyout(sectionLabel);
      });
    });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Effective role
  // ───────────────────────────────────────────────────────────────────────────

  const effectiveRole = useMemo(() => {
    if (user?.role) {
      return user.role;
    }

    if (typeof window !== "undefined") {
      try {
        const userStr =
          localStorage.getItem("nexus-user");

        if (userStr) {
          const parsedUser = JSON.parse(userStr);

          if (parsedUser?.role) {
            return parsedUser.role;
          }
        }

        const match = document.cookie.match(
          new RegExp(
            "(^| )nexus-role=([^;]+)"
          )
        );

        if (match) {
          return decodeURIComponent(match[2]);
        }
      } catch {
        // Ignore malformed local storage/cookie data.
      }
    }

    return "USER";
  }, [user?.role]);

  // ───────────────────────────────────────────────────────────────────────────
  // Menu sections
  // ───────────────────────────────────────────────────────────────────────────

  const menuSections = useMemo(() => {
    const role = effectiveRole;

    const rawSections =
      role === "SUPER_ADMIN"
        ? getSuperAdminMenu()
        : role === "ADMIN"
          ? getAdminMenu()
          : getUserMenu();

    const activePermissions =
      permissions || DEFAULT_PERMISSIONS;

    return rawSections
      .map((section) => {
        const filteredItems = section.items.filter(
          (item) => {
            // Change Password remains protected/available.
            if (item.href === "/settings/security") {
              return true;
            }

            // SUPER_ADMIN always gets permissions page.
            if (
              item.href === "/admin/permissions" &&
              role === "SUPER_ADMIN"
            ) {
              return true;
            }

            const dbAccess =
              activePermissions[item.href];

            const pageAccess =
              dbAccess !== undefined
                ? dbAccess
                : DEFAULT_PERMISSIONS[item.href];

            if (
              pageAccess === undefined ||
              pageAccess === null
            ) {
              return role === "SUPER_ADMIN";
            }

            if (
              typeof pageAccess === "boolean"
            ) {
              return pageAccess;
            }

            if (
              typeof pageAccess === "object"
            ) {
              return (
                (
                  pageAccess as Record<
                    string,
                    boolean
                  >
                )[role] === true
              );
            }

            return role === "SUPER_ADMIN";
          }
        );

        if (filteredItems.length === 0) {
          return null;
        }

        return {
          ...section,
          items: filteredItems,
        };
      })
      .filter(
        (section): section is MenuSection =>
          section !== null
      );
  }, [effectiveRole, permissions]);

  // Keep ref synchronized.
  menuSectionsRef.current = menuSections;

  // ───────────────────────────────────────────────────────────────────────────
  // Auto-expand current route
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pathname === "/") {
      return;
    }

    const activeSection =
      menuSections.find((section) =>
        section.items.some((item) =>
          pathname.startsWith(
            item.href
              .split("?")[0]
              .split("#")[0]
          )
        )
      );

    if (activeSection) {
      setExclusiveSection(activeSection.label);
    }
  }, [
    pathname,
    menuSections,
    setExclusiveSection,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Close flyout when navigation/sidebar mode changes
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setOpenFlyout(null);
    setFlyoutPos(null);
  }, [pathname, isCollapsed]);

  // ───────────────────────────────────────────────────────────────────────────
  // Outside click
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isCollapsed || !openFlyout) {
      return;
    }

    const onDocumentMouseDown = (
      event: MouseEvent
    ) => {
      const target = event.target as Node;

      // Click inside flyout.
      if (
        flyoutRef.current &&
        flyoutRef.current.contains(target)
      ) {
        return;
      }

      // Click the parent button that opened it.
      const parentButton =
        sectionButtonRefs.current[
        openFlyout
        ];

      if (
        parentButton &&
        parentButton.contains(target)
      ) {
        return;
      }

      setOpenFlyout(null);
      setFlyoutPos(null);
    };

    document.addEventListener(
      "mousedown",
      onDocumentMouseDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        onDocumentMouseDown
      );
    };
  }, [isCollapsed, openFlyout]);

  // ───────────────────────────────────────────────────────────────────────────
  // Reposition on resize
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isCollapsed || !openFlyout) {
      return;
    }

    const handleResize = () => {
      positionFlyout(openFlyout);
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [
    isCollapsed,
    openFlyout,
    menuSections,
  ]);

  // ───────────────────────────────────────────────────────────────────────────
  // Logout
  // ───────────────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await logout();

    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  const roleBadge =
    ROLE_BADGE[effectiveRole] ??
    ROLE_BADGE.USER;

  // ───────────────────────────────────────────────────────────────────────────
  // Loading state
  // ───────────────────────────────────────────────────────────────────────────

  if (!isMounted) {
    return (
      <aside className="w-64 sm:w-[240px] h-screen sticky top-0 shrink-0 bg-nexus-card border-r border-nexus-border flex flex-col overflow-hidden">
        <div className="h-16 shrink-0 px-5 border-b border-nexus-border flex items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10D078] to-emerald-400 flex items-center justify-center shadow-lg shadow-[#10D078]/25 text-black">
              <IconInfinity
                size={22}
                stroke={2.5}
              />
            </div>

            <div className="flex flex-col">
              <span className="text-base font-extrabold text-nexus-text tracking-tight leading-none">
                INFINITY VIBEZ
              </span>

              <span className="text-[9px] font-bold text-[#10D078] tracking-widest uppercase mt-0.5">
                CRM PLATFORM
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-3">
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
          <div className="h-9 bg-nexus-hover/40 rounded-lg animate-pulse" />
        </nav>
      </aside>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main sidebar
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <aside
      className={`
        ${isCollapsed
          ? "w-16"
          : "w-64 sm:w-[240px]"
        }
        relative
        h-screen
        sticky
        top-0
        shrink-0
        bg-nexus-card
        border-r
        border-nexus-border
        flex
        flex-col
        overflow-visible
        transition-[width]
        duration-200
        z-[70]
      `}
    >
      {/* ─────────────────────────────────────────────────────────────────────
          Collapse control

          Vertical up/down chevron.
          Attached to sidebar edge.
          Small gap before first navigation item.
      ───────────────────────────────────────────────────────────────────── */}

      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={
          isCollapsed
            ? "Expand navigation"
            : "Collapse navigation"
        }
        aria-expanded={!isCollapsed}
        className="
  hidden
  md:flex
  absolute
  right-[-9px]
  top-[72px]
  z-[100]
  w-[18px]
  h-[18px]
  items-center
  justify-center
  rounded-full
  border
  border-white/30
  bg-nexus-card
  text-white/70
  shadow-sm
  hover:bg-nexus-hover
  hover:border-white/50
  hover:text-white
  transition-colors
  focus:outline-none
"
      >
        {isCollapsed ? (
          <IconChevronRight
            size={10}
            stroke={2}
          />
        ) : (
          <IconChevronLeft
            size={10}
            stroke={2}
          />
        )}
      </button>
      {/* ─────────────────────────────────────────────────────────────────────
          Brand
      ───────────────────────────────────────────────────────────────────── */}

      <div
        className="
          h-16
          shrink-0
          px-4
          sm:px-5
          border-b
          border-nexus-border
          flex
          items-center
          justify-between
        "
      >
        <Link
          href="/dashboard"
          onClick={onClose}
          className={`
            flex
            items-center
            gap-2.5
            ${isCollapsed
              ? "justify-center w-full"
              : ""
            }
          `}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#10D078] to-emerald-400 flex items-center justify-center shadow-lg shadow-[#10D078]/25 text-black shrink-0">
            <IconInfinity
              size={22}
              stroke={2.5}
            />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-nexus-text tracking-tight leading-none">
                INFINITY VIBEZ
              </span>

              <span className="text-[9px] font-bold text-[#10D078] tracking-widest uppercase mt-0.5">
                CRM PLATFORM
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          Navigation

          Collapsed mode gets extra top padding so the collapse control
          has visible space before the first menu item.
      ───────────────────────────────────────────────────────────────────── */}

      <nav
        className={`
    flex-1
    overflow-y-auto
    overflow-x-hidden
    space-y-1
    ${isCollapsed
            ? "px-2 pt-2 pb-4"
            : "px-3 py-4"
          }
  `}
      >
        {menuSections.map((section) => {
          // ────────────────────────────────────────────────────────────────
          // Single-item sections
          // ────────────────────────────────────────────────────────────────

          if (section.items.length === 1) {
            const item = section.items[0];

            const hrefBase = item.href
              .split("?")[0]
              .split("#")[0];

            const isActive =
              pathname === hrefBase ||
              pathname.startsWith(
                hrefBase + "/"
              );

            return (
              <div
                key={section.label}
                className="pt-1"
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  title={
                    isCollapsed
                      ? item.label
                      : undefined
                  }
                  className={`
                    w-full
                    flex
                    items-center
                    gap-2.5
                    px-3
                    py-2
                    rounded-lg
                    text-xs
                    font-semibold
                    uppercase
                    tracking-wider
                    transition-colors

                    ${isActive
                      ? "text-[#10D078] bg-[#10D078]/10 font-bold"
                      : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
                    }

                    ${isCollapsed
                      ? "justify-center px-2"
                      : ""
                    }
                  `}
                >
                  {section.icon}

                  {!isCollapsed && (
                    <span>
                      {item.label}
                    </span>
                  )}
                </Link>
              </div>
            );
          }

          // ────────────────────────────────────────────────────────────────
          // Multi-item section
          // ────────────────────────────────────────────────────────────────

          const isExpanded =
            !!expandedSections[
            section.label
            ];

          const isSectionActive =
            section.items.some((item) =>
              pathname.startsWith(
                item.href
                  .split("?")[0]
                  .split("#")[0]
              )
            );

          const isFlyoutOpen =
            isCollapsed &&
            openFlyout === section.label;

          return (
            <div
              key={section.label}
              className="pt-1 relative"
            >
              {/* ─────────────────────────────────────────────────────────
                  Parent section button
              ───────────────────────────────────────────────────────── */}

              <button
                ref={(element) => {
                  sectionButtonRefs.current[
                    section.label
                  ] = element;
                }}
                type="button"
                data-flyout-section={
                  section.label
                }
                onClick={() => {
                  if (isCollapsed) {
                    openFlyoutFor(
                      section.label,
                      section.items
                    );
                  } else {
                    toggleSection(
                      section.label
                    );
                  }
                }}
                aria-expanded={
                  isCollapsed
                    ? isFlyoutOpen
                    : isExpanded
                }
                title={
                  isCollapsed
                    ? section.label
                    : undefined
                }
                className={`
                  w-full
                  flex
                  items-center
                  justify-between
                  px-3
                  py-2
                  rounded-lg
                  text-xs
                  font-semibold
                  tracking-wider
                  transition-colors

                  ${isSectionActive ||
                    isFlyoutOpen
                    ? "text-[#10D078] bg-[#10D078]/10"
                    : "text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover"
                  }

                  ${isCollapsed
                    ? "justify-center px-2"
                    : ""
                  }
                `}
              >
                <div
                  className={`
                    flex
                    items-center
                    gap-2.5
                    ${isCollapsed
                      ? "justify-center"
                      : ""
                    }
                  `}
                >
                  {section.icon}

                  {!isCollapsed && (
                    <span>
                      {section.label}
                    </span>
                  )}
                </div>

                {!isCollapsed &&
                  (isExpanded ? (
                    <IconChevronUp
                      size={14}
                      className="text-nexus-muted"
                    />
                  ) : (
                    <IconChevronDown
                      size={14}
                      className="text-nexus-muted"
                    />
                  ))}
              </button>

              {/* ─────────────────────────────────────────────────────────
                  Expanded sidebar accordion
              ───────────────────────────────────────────────────────── */}

              {isExpanded &&
                !isCollapsed && (
                  <div className="ml-4 pl-3 border-l border-nexus-border/60 my-1 space-y-0.5">
                    {section.items.map(
                      (item) => {
                        const hrefBase =
                          item.href
                            .split("?")[0]
                            .split("#")[0];

                        const isActive =
                          pathname ===
                          hrefBase ||
                          pathname.startsWith(
                            hrefBase + "/"
                          );

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() =>
                              setOpenFlyout(
                                null
                              )
                            }
                            className={`
                              block
                              px-2.5
                              py-1
                              rounded-md
                              text-[11px]
                              font-semibold
                              transition-colors

                              ${isActive
                                ? "text-[#10D078] font-bold bg-[#10D078]/10"
                                : "text-nexus-text hover:bg-nexus-hover"
                              }
                            `}
                          >
                            {item.label}
                          </Link>
                        );
                      }
                    )}
                  </div>
                )}

              {/* ─────────────────────────────────────────────────────────
                  Collapsed sidebar floating submenu

                  IMPORTANT:
                  flyoutPos.top comes directly from the clicked parent
                  button's getBoundingClientRect().top.
              ───────────────────────────────────────────────────────── */}

              {isFlyoutOpen && (
                <div
                  ref={flyoutRef}
                  style={{
                    position: "fixed",
                    top:
                      flyoutPos?.top ??
                      sectionButtonRefs.current[
                        section.label
                      ]?.getBoundingClientRect()
                        .top ??
                      8,
                    left:
                      flyoutPos?.left ?? 72,
                  }}
                  className="
                    z-[100]
                    min-w-[200px]
                    max-w-[280px]
                    overflow-hidden
                    rounded-xl
                    border
                    border-nexus-border
                    border-l-2
                    border-l-[#10D078]
                    bg-nexus-card
                    shadow-2xl
                    animate-in
                    fade-in
                    slide-in-from-left-2
                    duration-150
                  "
                  role="menu"
                  aria-label={
                    section.label
                  }
                >
                  {/* Flyout title */}
                  <div className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-nexus-muted border-b border-nexus-border/60">
                    {section.label}
                  </div>

                  {/* Flyout items */}
                  <div className="py-1">
                    {section.items.map(
                      (item) => {
                        const hrefBase =
                          item.href
                            .split("?")[0]
                            .split("#")[0];

                        const isActive =
                          pathname ===
                          hrefBase ||
                          pathname.startsWith(
                            hrefBase + "/"
                          );

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            onClick={() => {
                              setOpenFlyout(
                                null
                              );
                              setFlyoutPos(
                                null
                              );
                              onClose?.();
                            }}
                            className={`
                              block
                              px-3.5
                              py-2.5
                              text-[11px]
                              font-semibold
                              transition-colors

                              ${isActive
                                ? "text-[#10D078] font-bold bg-[#10D078]/10"
                                : "text-nexus-text hover:bg-nexus-hover"
                              }
                            `}
                          >
                            {item.label}
                          </Link>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ─────────────────────────────────────────────────────────────────────
          User profile / logout intentionally remains in the existing
          top/header area as in your current layout.
      ───────────────────────────────────────────────────────────────────── */}
    </aside>
  );
}