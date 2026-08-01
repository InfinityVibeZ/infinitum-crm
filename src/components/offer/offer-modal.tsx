"use client";

import { useState, useEffect } from "react";
import { IconX, IconPlus, IconTrash } from "@tabler/icons-react";

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerData?: any;
  onSuccess: () => void;
}

export function OfferModal({
  isOpen,
  onClose,
  offerData,
  onSuccess,
}: OfferModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Standard");
  const [status, setStatus] = useState("ACTIVE");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (offerData) {
      setName(offerData.name || "");
      setPrice(offerData.price ? offerData.price.toString() : "");
      setCategory(offerData.category || "Standard");
      setStatus(offerData.status || "ACTIVE");
      setDescription(offerData.description || "");
      setFeatures(
        Array.isArray(offerData.features) && offerData.features.length > 0
          ? offerData.features
          : [""]
      );
    } else {
      setName("");
      setPrice("");
      setCategory("Standard");
      setStatus("ACTIVE");
      setDescription("");
      setFeatures([""]);
    }
  }, [offerData, isOpen]);

  if (!isOpen) return null;

  const handleAddFeature = () => {
    setFeatures([...features, ""]);
  };

  const handleRemoveFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  const handleFeatureChange = (idx: number, val: string) => {
    const updated = [...features];
    updated[idx] = val;
    setFeatures(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setLoading(true);

    const validFeatures = features.filter((f) => f.trim() !== "");

    try {
      const url = offerData ? `/api/offers/${offerData.id}` : "/api/offers";
      const method = offerData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price,
          category,
          status,
          description,
          features: validFeatures,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl w-full max-w-lg shadow-2xl space-y-4 p-6 text-nexus-text">
        <div className="flex justify-between items-center pb-3 border-b border-[#151B2C]">
          <h2 className="text-lg font-bold text-white">
            {offerData ? "Edit Offer" : "Create New Offer"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-nexus-muted hover:text-white rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-nexus-muted mb-1">
              Offer Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Full Growth Lead Engine Tier"
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-nexus-muted mb-1">
                Price (₹/mo) *
              </label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="5000"
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>

            <div>
              <label className="block font-semibold text-nexus-muted mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="Basic">Basic</option>
                <option value="Standard">Standard</option>
                <option value="Premium">Premium</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-nexus-muted mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-nexus-muted mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summary of deliverables and scope..."
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-2.5 text-white focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-nexus-muted">
                Deliverables & Included Features
              </label>
              <button
                type="button"
                onClick={handleAddFeature}
                className="text-[11px] text-[#10D078] hover:underline flex items-center gap-1 font-semibold"
              >
                <IconPlus size={14} /> Add Feature
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feat}
                    onChange={(e) => handleFeatureChange(idx, e.target.value)}
                    placeholder={`Deliverable #${idx + 1}`}
                    className="flex-1 bg-[#06080F] border border-[#151B2C] rounded-lg p-2 text-white focus:outline-none focus:border-[#10D078]"
                  />
                  {features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(idx)}
                      className="p-2 text-rose-400 hover:bg-[#141A29] rounded-lg"
                    >
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#151B2C]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#06080F] border border-[#151B2C] rounded-lg text-nexus-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg shadow-lg shadow-[#10D078]/20"
            >
              {loading ? "Saving..." : offerData ? "Update Offer" : "Create Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
