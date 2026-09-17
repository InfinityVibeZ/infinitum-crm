"use client";

import { useEffect, useState } from "react";


interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  leads: any[];
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      try {
        const res = await fetch("/api/contacts");
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        }
      } catch (e) {
        console.error("Error fetching contacts:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchContacts();
  }, []);

  return (
    <div className="flex flex-col h-full bg-nexus-bg">
      <div className="px-6 py-4 border-b border-nexus-border">
        <h1 className="text-xl font-bold text-nexus-text">Contacts</h1>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-nexus-surface rounded-xl border border-nexus-border overflow-hidden">
            <div className="p-4 border-b border-nexus-border bg-nexus-surface/50">
              <h2 className="font-semibold text-nexus-text">All Contacts</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-nexus-text-secondary">Loading...</div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center text-nexus-text-secondary">No contacts found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-nexus-text">
                  <thead className="bg-nexus-surface/50 border-b border-nexus-border">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Phone</th>
                      <th className="px-6 py-3 font-medium">Associated Leads</th>
                      <th className="px-6 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nexus-border">
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-nexus-surface/50 transition-colors">
                        <td className="px-6 py-4 font-medium">{contact.name || "Unknown"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">{contact.email || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">{contact.phone || "—"}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">
                          {contact.leads.length} leads
                        </td>
                        <td className="px-6 py-4 text-nexus-text-secondary whitespace-nowrap">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
