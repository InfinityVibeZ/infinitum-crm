"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";

export interface AssigneeOption {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface SearchableAssigneeSelectProps {
  admins: AssigneeOption[];
  users: AssigneeOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function matchesQuery(option: AssigneeOption, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return option.name.toLowerCase().includes(q) || (option.email || "").toLowerCase().includes(q);
}

export function SearchableAssigneeSelect({
  admins,
  users,
  value,
  onChange,
  disabled,
  placeholder = "Select Assignee...",
}: SearchableAssigneeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => [...admins, ...users].find((u) => u.id === value),
    [admins, users, value]
  );

  const filteredAdmins = useMemo(() => admins.filter((a) => matchesQuery(a, query)), [admins, query]);
  const filteredUsers = useMemo(() => users.filter((u) => matchesQuery(u, query)), [users, query]);
  const hasResults = filteredAdmins.length > 0 || filteredUsers.length > 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function selectOption(id: string) {
    onChange(id);
    setIsOpen(false);
    setQuery("");
  }

  function openDropdown() {
    if (disabled) return;
    setIsOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div ref={containerRef} className="relative">
      {!isOpen ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openDropdown}
          className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm text-left ${
            disabled
              ? "bg-nexus-hover border-nexus-border text-nexus-muted cursor-not-allowed"
              : "bg-nexus-bg border-nexus-border text-nexus-text hover:border-nexus-primary/40"
          }`}
        >
          <span className={selected ? "" : "text-nexus-muted"}>
            {selected ? selected.name : placeholder}
          </span>
          <IconChevronDown size={14} className="text-nexus-muted shrink-0" />
        </button>
      ) : (
        <div className="relative">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full border border-nexus-primary/50 rounded-lg pl-8 pr-8 py-2 text-sm bg-nexus-bg text-nexus-text focus:outline-none"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setIsOpen(false);
              setQuery("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-text"
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-nexus-card border border-nexus-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectOption("")}
            className="w-full text-left px-3 py-2 text-xs text-nexus-muted hover:bg-nexus-hover transition-colors"
          >
            — Unassigned —
          </button>

          {!hasResults && (
            <div className="px-3 py-3 text-xs text-nexus-muted text-center">No matches found</div>
          )}

          {filteredAdmins.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-nexus-muted bg-nexus-hover/40 sticky top-0">
                Admins
              </div>
              {filteredAdmins.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(a.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-nexus-hover transition-colors ${
                    a.id === value ? "bg-nexus-primary/10 text-nexus-primary font-medium" : "text-nexus-text"
                  }`}
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}

          {filteredAdmins.length > 0 && filteredUsers.length > 0 && (
            <div className="border-t border-nexus-border" />
          )}

          {filteredUsers.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-nexus-muted bg-nexus-hover/40 sticky top-0">
                Users
              </div>
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(u.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-nexus-hover transition-colors ${
                    u.id === value ? "bg-nexus-primary/10 text-nexus-primary font-medium" : "text-nexus-text"
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
