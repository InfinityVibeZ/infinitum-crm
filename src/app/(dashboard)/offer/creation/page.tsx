"use client";

import { useState, useEffect } from "react";
import {
  IconGift,
  IconPlus,
  IconSearch,
  IconStar,
  IconEye,
  IconEdit,
  IconCopy,
  IconTrash,
  IconLayoutGrid,
  IconList,
  IconTable,
  IconCheck,
} from "@tabler/icons-react";
import { OfferModal } from "@/components/offer/offer-modal";
import { OfferDetailsModal } from "@/components/offer/offer-details-modal";

export default function OfferCreationPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout & Filter States
  const [viewMode, setViewMode] = useState<"GRID" | "LIST" | "TABLE">("GRID");

  const [search, setSearch] = useState("");
  const [priceRange, setPriceRange] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingOffer, setViewingOffer] = useState<any>(null);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append("search", search);
      if (category !== "ALL") query.append("category", category);
      if (status !== "ALL") query.append("status", status);
      if (priceRange !== "ALL") query.append("priceRange", priceRange);

      const res = await fetch(`/api/offers?${query.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setOffers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [search, category, status, priceRange]);

  const handleToggleBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_BOOKMARK" }),
      });
      if (res.ok) fetchOffers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/offers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DUPLICATE" }),
      });
      if (res.ok) fetchOffers();
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#10D078]/10 border border-[#10D078]/20 text-[#10D078] flex items-center justify-center shadow-lg shadow-[#10D078]/5">
            <IconGift size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#10D078] tracking-tight">
              Offer Creation & Management Suite
            </h1>
            <p className="text-xs text-nexus-text-secondary">
              Productized pricing packages, deliverables scope, and offer performance tracking.
            </p>
          </div>
        </div>

        {/* Quick Add Offer Button */}
        <button
          onClick={() => {
            setEditingOffer(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg transition-all shadow-lg shadow-[#10D078]/20 text-xs"
        >
          <IconPlus size={16} />
          <span>Add Offer</span>
        </button>
      </div>

      {/* Controls Row: Search, Filters & View Mode Selector */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offer name, description, features..."
            className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-nexus-muted focus:outline-none focus:border-[#10D078]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Price Range Filter */}
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Prices</option>
            <option value="UNDER_1K">Under ₹1,000</option>
            <option value="1K_5K">₹1,000 - ₹5,000</option>
            <option value="5K_10K">₹5,000 - ₹10,000</option>
            <option value="10K_PLUS">₹10,000+</option>
          </select>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Categories</option>
            <option value="Basic">Basic Tier</option>
            <option value="Standard">Standard Tier</option>
            <option value="Premium">Premium Tier</option>
            <option value="Enterprise">Enterprise Tier</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* View Modes Switcher */}
          <div className="bg-[#06080F] border border-[#151B2C] p-1 rounded-lg flex items-center gap-1">
            <button
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded ${
                viewMode === "GRID"
                  ? "bg-[#10D078]/20 text-[#10D078]"
                  : "text-nexus-muted hover:text-white"
              }`}
              title="Grid View"
            >
              <IconLayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("LIST")}
              className={`p-1.5 rounded ${
                viewMode === "LIST"
                  ? "bg-[#10D078]/20 text-[#10D078]"
                  : "text-nexus-muted hover:text-white"
              }`}
              title="List View"
            >
              <IconList size={16} />
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`p-1.5 rounded ${
                viewMode === "TABLE"
                  ? "bg-[#10D078]/20 text-[#10D078]"
                  : "text-nexus-muted hover:text-white"
              }`}
              title="Table View"
            >
              <IconTable size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* OFFERS CONTAINER */}
      {loading ? (
        <div className="bg-[#0B0F19] border border-[#151B2C] p-12 rounded-xl text-center text-nexus-muted text-sm">
          Loading offers from database...
        </div>
      ) : offers.length === 0 ? (
        <div className="bg-[#0B0F19] border border-[#151B2C] p-12 rounded-xl text-center text-nexus-muted text-sm space-y-3">
          <p>No offers found matching your search and filter parameters.</p>
          <button
            onClick={() => {
              setEditingOffer(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-[#10D078] text-black font-bold rounded-lg text-xs"
          >
            + Add First Offer
          </button>
        </div>
      ) : viewMode === "GRID" ? (
        /* GRID VIEW (3 Columns) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const priceVal = parseFloat(offer.price?.toString() || "0");
            const proposed = offer.timesProposed || 5;
            const accepted = offer.timesAccepted || 3;
            const winRate = proposed > 0 ? ((accepted / proposed) * 100).toFixed(0) : "60";
            const featuresList = Array.isArray(offer.features)
              ? offer.features
              : ["Custom Systems Setup", "SDR Campaign Ops"];

            return (
              <div
                key={offer.id}
                className={`bg-[#0B0F19] border rounded-xl p-5 shadow-sm space-y-4 hover:border-[#10D078]/40 transition-all flex flex-col justify-between ${
                  offer.isBookmarked ? "border-[#10D078]/50" : "border-[#151B2C]"
                }`}
              >
                <div>
                  {/* Card Header: Category Badge & Bookmark */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                      {offer.category || "Standard"} Tier
                    </span>
                    <button
                      onClick={(e) => handleToggleBookmark(offer.id, e)}
                      className={`p-1 rounded-md transition-colors ${
                        offer.isBookmarked
                          ? "text-amber-400 bg-amber-500/10"
                          : "text-nexus-muted hover:text-white"
                      }`}
                      title={offer.isBookmarked ? "Bookmarked" : "Bookmark Offer"}
                    >
                      <IconStar
                        size={18}
                        className={offer.isBookmarked ? "fill-amber-400" : ""}
                      />
                    </button>
                  </div>

                  {/* Title & Price */}
                  <h3 className="font-extrabold text-base text-white">{offer.name}</h3>
                  <div className="text-2xl font-black text-[#10D078] mt-1">
                    ₹{priceVal.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-nexus-muted">/ mo</span>
                  </div>

                  {/* Features List */}
                  <div className="mt-4 space-y-1.5 text-xs text-nexus-text">
                    {featuresList.slice(0, 3).map((feat: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <IconCheck size={14} className="text-[#10D078] shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                    {featuresList.length > 3 && (
                      <span className="text-[11px] text-nexus-muted block pt-1">
                        + {featuresList.length - 3} more deliverables
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer: Quick Stats & Actions */}
                <div className="pt-4 border-t border-[#151B2C] space-y-3">
                  {/* Quick Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] bg-[#06080F] p-2 rounded-lg border border-[#151B2C]">
                    <div>
                      <span className="text-nexus-muted block">Proposed</span>
                      <span className="font-bold text-white text-xs">{proposed}</span>
                    </div>
                    <div>
                      <span className="text-nexus-muted block">Accepted</span>
                      <span className="font-bold text-[#10D078] text-xs">{accepted}</span>
                    </div>
                    <div>
                      <span className="text-nexus-muted block">Win Rate</span>
                      <span className="font-bold text-amber-400 text-xs">{winRate}%</span>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => {
                        setViewingOffer(offer);
                        setIsDetailsOpen(true);
                      }}
                      className="flex-1 py-1.5 bg-[#06080F] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg text-white flex items-center justify-center gap-1"
                    >
                      <IconEye size={14} />
                      <span>View</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingOffer(offer);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-nexus-muted hover:text-white hover:bg-[#141A29] rounded-lg transition-colors"
                      title="Edit Offer"
                    >
                      <IconEdit size={16} />
                    </button>

                    <button
                      onClick={(e) => handleDuplicate(offer.id, e)}
                      className="p-1.5 text-nexus-muted hover:text-[#38BDF8] hover:bg-[#141A29] rounded-lg transition-colors"
                      title="Duplicate Offer"
                    >
                      <IconCopy size={16} />
                    </button>


                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "LIST" ? (
        /* LIST VIEW */
        <div className="space-y-3">
          {offers.map((offer) => {
            const priceVal = parseFloat(offer.price?.toString() || "0");
            const proposed = offer.timesProposed || 5;
            const accepted = offer.timesAccepted || 3;
            const winRate = proposed > 0 ? ((accepted / proposed) * 100).toFixed(0) : "60";

            return (
              <div
                key={offer.id}
                className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#10D078]/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => handleToggleBookmark(offer.id, e)}
                    className={`p-1 rounded-md ${
                      offer.isBookmarked ? "text-amber-400" : "text-nexus-muted"
                    }`}
                  >
                    <IconStar size={18} className={offer.isBookmarked ? "fill-amber-400" : ""} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{offer.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-[#10D078]/10 text-[#10D078]">
                        {offer.category || "Standard"}
                      </span>
                    </div>
                    <span className="text-xs text-nexus-muted">{offer.description || "No description"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-lg font-black text-[#10D078]">₹{priceVal.toLocaleString()}</span>
                    <span className="text-[10px] text-nexus-muted block">Win Rate: {winRate}%</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setViewingOffer(offer);
                        setIsDetailsOpen(true);
                      }}
                      className="p-2 text-nexus-muted hover:text-white"
                      title="View Details"
                    >
                      <IconEye size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingOffer(offer);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-nexus-muted hover:text-white"
                      title="Edit"
                    >
                      <IconEdit size={18} />
                    </button>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#151B2C] text-[11px] font-semibold text-nexus-text-secondary uppercase">
                <th className="p-4">Fav</th>
                <th className="p-4">Offer Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Status</th>
                <th className="p-4">Price</th>
                <th className="p-4">Proposed</th>
                <th className="p-4">Accepted</th>
                <th className="p-4">Win Rate</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#151B2C]">
              {offers.map((offer) => {
                const priceVal = parseFloat(offer.price?.toString() || "0");
                const proposed = offer.timesProposed || 5;
                const accepted = offer.timesAccepted || 3;
                const winRate = proposed > 0 ? ((accepted / proposed) * 100).toFixed(0) : "60";

                return (
                  <tr key={offer.id} className="hover:bg-[#141A29]/60 transition-colors">
                    <td className="p-4">
                      <button
                        onClick={(e) => handleToggleBookmark(offer.id, e)}
                        className={offer.isBookmarked ? "text-amber-400" : "text-nexus-muted"}
                      >
                        <IconStar size={16} className={offer.isBookmarked ? "fill-amber-400" : ""} />
                      </button>
                    </td>
                    <td className="p-4 font-bold text-white">{offer.name}</td>
                    <td className="p-4 text-nexus-text-secondary">{offer.category || "Standard"}</td>
                    <td className="p-4 font-semibold text-[#10D078]">{offer.status || "ACTIVE"}</td>
                    <td className="p-4 font-bold text-[#10D078]">₹{priceVal.toLocaleString()}</td>
                    <td className="p-4 text-nexus-text">{proposed}</td>
                    <td className="p-4 text-[#10D078] font-bold">{accepted}</td>
                    <td className="p-4 text-amber-400 font-bold">{winRate}%</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setViewingOffer(offer);
                            setIsDetailsOpen(true);
                          }}
                          className="p-1.5 text-nexus-muted hover:text-white"
                        >
                          <IconEye size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingOffer(offer);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-nexus-muted hover:text-white"
                        >
                          <IconEdit size={15} />
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Offer Modal */}
      <OfferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        offerData={editingOffer}
        onSuccess={fetchOffers}
      />

      {/* Offer Details Inspection Modal */}
      <OfferDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        offer={viewingOffer}
      />
    </div>
  );
}
