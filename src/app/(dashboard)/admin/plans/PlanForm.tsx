import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plan, BillingPrice, PlanFeature, Feature } from '@prisma/client';
import { apiClient } from "@/lib/apiClient";
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  IconArrowLeft, 
  IconCheck, 
  IconSettings, 
  IconChevronDown, 
  IconChevronUp, 
  IconDeviceFloppy,
  IconLoader2
} from '@tabler/icons-react';

// Types
interface PriceInput {
  billingInterval: string;
  enabled: boolean;
  currency: string;
  amount: number | '';
  originalAmount?: number | '';
  trailingDays: number | '';
  isActive: boolean;
}

interface FeatureInput {
  featureId: string;
  enabled: boolean;
  limitType?: string;
  limitValue?: number | '';
  configuration?: string; // JSON string
}

interface PlanFormProps {
  mode: 'create' | 'edit';
  initialData?: any; // full plan object for edit
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

const getIntervalLabel = (interval: string) => {
  const labels: Record<string, { title: string; desc: string }> = {
    DAY: { title: 'Daily', desc: 'Charged every day' },
    WEEK: { title: 'Weekly', desc: 'Charged every week' },
    MONTH: { title: 'Monthly', desc: 'Charged every month' },
    QUARTER: { title: 'Quarterly', desc: 'Charged every 3 months' },
    HALF_YEAR: { title: 'Half-Yearly', desc: 'Charged every 6 months' },
    YEAR: { title: 'Yearly', desc: 'Charged every year' },
  };
  return labels[interval] || { title: interval, desc: `Charged per ${interval.toLowerCase()}` };
};

function classNames(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function PlanForm({ mode, initialData }: PlanFormProps) {
  const router = useRouter();
  
  // Basic State
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState(initialData?.status || 'ACTIVE');
  const [isPublic, setIsPublic] = useState(initialData?.isPublic ?? true);
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);
  
  // Pricing State
  const [billingIntervals, setBillingIntervals] = useState<string[]>([]);
  const [prices, setPrices] = useState<PriceInput[]>([]);
  const [currency, setCurrency] = useState(initialData?.currency || 'INR');

  // Features State
  const [features, setFeatures] = useState<FeatureInput[]>([]);
  const [availableFeatures, setAvailableFeatures] = useState<any[]>([]);
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({});

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const token = localStorage.getItem('nexus-token');
        const headers = { Authorization: `Bearer ${token}` };

        const [featuresRes, intervalsRes] = await Promise.all([
          fetch('/api/admin/features', { headers }),
          fetch('/api/admin/plans/intervals', { headers }),
        ]);

        if (!featuresRes.ok || !intervalsRes.ok) throw new Error('Failed to load configurations');

        const featuresData = await featuresRes.json();
        const intervalsData = await intervalsRes.json();

        setAvailableFeatures(featuresData);
        
        const initFeatures = featuresData.map((f: any) => {
          const existing = initialData?.features?.find((pf: any) => pf.featureId === f.id);
          return {
            featureId: f.id,
            enabled: !!existing,
            limitType: existing?.limitType || '',
            limitValue: existing?.limitValue ?? '',
            configuration: existing?.configuration ? JSON.stringify(existing.configuration, null, 2) : '',
          } as FeatureInput;
        });
        setFeatures(initFeatures);

        const loadedIntervals = intervalsData.data || ['MONTH', 'QUARTER', 'HALF_YEAR', 'YEAR'];
        setBillingIntervals(loadedIntervals);

        const initPrices = loadedIntervals.map((interval: string) => {
          const existing = initialData?.prices?.find((p: any) => p.billingInterval === interval);
          return {
            billingInterval: interval,
            enabled: mode === 'create' ? true : !!existing,
            currency: existing?.currency || 'INR',
            amount: existing?.amount ?? '',
            originalAmount: existing?.originalAmount ?? '',
            trailingDays: existing?.trailingDays ?? 0,
            isActive: existing?.isActive ?? true,
          } as PriceInput;
        });
        setPrices(initPrices);

      } catch (e: any) {
        toast.error(e.message || 'Failed to load configuration');
      }
    };
    
    fetchConfigs();
  }, [initialData, mode]);

  const handlePriceChange = (idx: number, field: keyof PriceInput, value: any) => {
    let sanitizedValue = value;
    if (field === 'amount' || field === 'originalAmount') {
      sanitizedValue = String(value).replace(/[^0-9.]/g, '');
      let parts = sanitizedValue.split('.');
      if (parts.length > 2) {
        parts = [parts[0], parts.slice(1).join('')];
      }
      if (parts.length === 2 && parts[1].length > 2) {
        parts[1] = parts[1].substring(0, 2);
      }
      sanitizedValue = parts.join('.');
    } else if (field === 'trailingDays') {
      sanitizedValue = String(value).replace(/[^0-9]/g, '');
      if (sanitizedValue.length > 2) {
        sanitizedValue = sanitizedValue.substring(0, 2);
      }
    }

    setPrices((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: sanitizedValue };
      return copy;
    });
    // Clear error for this field
    setFieldErrors(prev => ({ ...prev, [`price-${idx}-${field}`]: '' }));
  };

  const handleFeatureChange = (idx: number, field: keyof FeatureInput, value: any) => {
    setFeatures((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
    setFieldErrors(prev => ({ ...prev, [`feature-${idx}-${field}`]: '' }));
  };

  const toggleFeatureConfig = (featureId: string) => {
    setExpandedFeatures(prev => ({ ...prev, [featureId]: !prev[featureId] }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    if (!name.trim()) { errors['name'] = 'Plan Name is required'; isValid = false; }
    if (!code.trim()) { errors['code'] = 'Plan Code is required'; isValid = false; }

    prices.forEach((p, idx) => {
      if (!p.enabled) return;
      if (p.amount === '' || Number(p.amount) < 0) { 
        errors[`price-${idx}-amount`] = `Enter a valid ${getIntervalLabel(p.billingInterval).title.toLowerCase()} price`; 
        isValid = false; 
      }
      if (p.originalAmount !== '' && Number(p.originalAmount) < Number(p.amount)) { 
        errors[`price-${idx}-originalAmount`] = 'Original price must be >= amount'; 
        isValid = false; 
      }
      if (Number(p.trailingDays) < 0) { 
        errors[`price-${idx}-trailingDays`] = 'Cannot be negative'; 
        isValid = false; 
      }
    });

    const hasEnabledPrice = prices.some(p => p.enabled);
    if (!hasEnabledPrice) {
      toast.error('You must enable at least one billing cycle.');
      isValid = false;
    }

    features.forEach((f, idx) => {
      if (f.enabled && f.configuration) {
        try {
          JSON.parse(f.configuration);
        } catch {
          errors[`feature-${idx}-configuration`] = 'Configuration must contain valid JSON';
          isValid = false;
          // auto expand if there is an error
          setExpandedFeatures(prev => ({ ...prev, [f.featureId]: true }));
        }
      }
    });

    setFieldErrors(errors);
    if (!isValid && Object.keys(errors).length > 0) {
      toast.error('Please fix the errors in the form.');
    }
    
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSaving(true);

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description,
      status,
      isPublic,
      isDefault,
      currency,
      prices: prices.filter(p => p.enabled).map(p => ({
        billingInterval: p.billingInterval,
        currency,
        amount: Number(p.amount),
        originalAmount: p.originalAmount === '' ? undefined : Number(p.originalAmount),
        trailingDays: Number(p.trailingDays),
        isActive: p.isActive,
      })),
      features: features.filter(f => f.enabled).map(f => ({
        featureId: f.featureId,
        enabled: f.enabled,
        limitType: f.limitType || undefined,
        limitValue: f.limitValue === '' ? undefined : Number(f.limitValue),
        configuration: f.configuration ? JSON.parse(f.configuration) : undefined,
      })),
    };

    const url = mode === 'create' ? '/api/admin/plans' : `/api/admin/plans/${initialData?.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    
    try {
      const data = await (method === 'POST' ? apiClient.post(url, payload) : apiClient.patch(url, payload));
      if (data.success === true) {
        setIsSaving(false);
        toast.success('Plan saved successfully');
        router.push('/admin/plans');
      } else {
        throw new Error('API did not return success');
      }
    } catch (e: any) {
      toast.error(e.message);
      setIsSaving(false);
    }
  };

  // Compute grouped features
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, typeof features> = {};
    features.forEach((f) => {
      const af = availableFeatures.find(a => a.id === f.featureId);
      const moduleName = af?.module || 'General';
      if (!groups[moduleName]) groups[moduleName] = [];
      groups[moduleName].push(f);
    });
    return groups;
  }, [features, availableFeatures]);

  const enabledFeaturesCount = features.filter(f => f.enabled).length;

  return (
    <div className="text-nexus-text">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <Link href="/admin/plans" className="inline-flex items-center text-sm font-medium text-nexus-text-secondary hover:text-nexus-primary transition-colors mb-2">
            <IconArrowLeft size={16} className="mr-1" /> Back to Plans
          </Link>
          <h1 className="text-3xl font-extrabold">{mode === 'create' ? 'Create New Plan' : 'Edit Plan'}</h1>
          <p className="text-nexus-text-secondary mt-1">Configure the plan, pricing, billing cycles and feature access.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => router.push('/admin/plans')} 
            className="px-4 py-2 bg-nexus-card border border-nexus-border rounded-xl text-sm font-semibold hover:bg-nexus-hover transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-nexus-primary text-black rounded-xl text-sm font-bold shadow-lg hover:bg-nexus-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />}
            {isSaving ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* MAIN CONTENT */}
        <div className="flex-1 space-y-8 min-w-0 w-full">
          
          {/* SECTION 1 - PLAN DETAILS */}
          <section className="bg-nexus-card border border-nexus-border rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold">PLAN DETAILS</h2>
              <p className="text-xs text-nexus-text-secondary">Define how this plan appears and how customers can access it.</p>
            </div>
            
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-1">Plan Name *</label>
                  <input 
                    placeholder="e.g. Professional"
                    className={classNames("w-full p-2.5 bg-nexus-bg border rounded-xl text-sm focus:outline-none focus:border-nexus-primary transition-colors", fieldErrors['name'] ? "border-red-500/50" : "border-nexus-border")} 
                    value={name} 
                    onChange={(e) => { setName(e.target.value); setFieldErrors(p => ({...p, name: ''})); }} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Plan Code *</label>
                  <input 
                    placeholder="e.g. PROFESSIONAL"
                    className={classNames("w-full p-2.5 bg-nexus-bg border rounded-xl text-sm uppercase focus:outline-none focus:border-nexus-primary transition-colors", fieldErrors['code'] ? "border-red-500/50" : "border-nexus-border")} 
                    value={code} 
                    onChange={(e) => { setCode(e.target.value); setFieldErrors(p => ({...p, code: ''})); }} 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea 
                  placeholder="A brief description of this plan..."
                  className="w-full p-2.5 bg-nexus-bg border border-nexus-border rounded-xl text-sm min-h-[80px] focus:outline-none focus:border-nexus-primary transition-colors" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div>
                  <label className="block text-sm font-semibold mb-2">Status</label>
                  <div className="flex bg-nexus-bg p-1 rounded-xl border border-nexus-border">
                    <button type="button" onClick={() => setStatus('ACTIVE')} className={classNames("flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors", status === 'ACTIVE' ? "bg-nexus-card shadow text-emerald-400" : "text-nexus-muted hover:text-nexus-text")}>ACTIVE</button>
                    <button type="button" onClick={() => setStatus('INACTIVE')} className={classNames("flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors", status === 'INACTIVE' ? "bg-nexus-card shadow text-nexus-text" : "text-nexus-muted hover:text-nexus-text")}>INACTIVE</button>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                      <div className={classNames("block w-10 h-6 rounded-full transition-colors", isPublic ? "bg-nexus-primary" : "bg-nexus-bg border border-nexus-border")}></div>
                      <div className={classNames("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", isPublic ? "translate-x-4" : "")}></div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Public Plan</div>
                      <div className="text-[10px] text-nexus-text-secondary">Customers can see this plan on the public pricing page.</div>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                      <div className={classNames("block w-10 h-6 rounded-full transition-colors", isDefault ? "bg-nexus-primary" : "bg-nexus-bg border border-nexus-border")}></div>
                      <div className={classNames("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", isDefault ? "translate-x-4" : "")}></div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Default Plan</div>
                      <div className="text-[10px] text-nexus-text-secondary">Use this plan as the default selection for new customers.</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2 - PRICING & BILLING */}
          <section className="bg-nexus-card border border-nexus-border rounded-2xl p-6 shadow-sm">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">PRICING & BILLING</h2>
                <p className="text-xs text-nexus-text-secondary">Set the price customers pay for each billing cycle.</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-nexus-text-secondary uppercase">Plan Currency</label>
                <div className="relative w-32">
                  <select 
                    className="w-full appearance-none bg-nexus-bg border border-nexus-border rounded-lg p-2 text-sm font-semibold focus:outline-none focus:border-nexus-primary transition-colors"
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <IconChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {prices.map((p, idx) => {
                const label = getIntervalLabel(p.billingInterval);
                const amountVal = Number(p.amount) || 0;
                const origVal = Number(p.originalAmount);
                const hasDiscount = origVal > amountVal;
                const discountPct = hasDiscount ? Math.round(((origVal - amountVal) / origVal) * 100) : 0;

                return (
                  <div key={p.billingInterval} className={classNames("border rounded-2xl overflow-hidden transition-all flex flex-col h-full", p.enabled ? "border-nexus-primary/30 shadow-md bg-nexus-primary/5" : "border-nexus-border bg-nexus-bg opacity-70")}>
                    
                    {/* Card Header */}
                    <div className="flex items-center justify-between p-4 border-b border-nexus-border/50 bg-nexus-card">
                      <div className="flex items-center gap-3">
                        <label className="relative flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only" checked={p.enabled} onChange={(e) => handlePriceChange(idx, 'enabled', e.target.checked)} />
                          <div className={classNames("w-5 h-5 rounded border flex items-center justify-center transition-colors", p.enabled ? "bg-nexus-primary border-nexus-primary text-black" : "border-nexus-border bg-nexus-bg")}>
                            {p.enabled && <IconCheck size={14} stroke={3} />}
                          </div>
                        </label>
                        <div>
                          <h4 className="font-bold text-sm">{label.title}</h4>
                          <p className="text-[10px] text-nexus-muted">{label.desc}</p>
                        </div>
                      </div>
                      
                      {p.enabled && (
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                          <div className={classNames("w-2 h-2 rounded-full", p.isActive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-nexus-muted")} />
                          <span className={p.isActive ? "text-emerald-400" : "text-nexus-muted"}>{p.isActive ? "Active" : "Inactive"}</span>
                          <input type="checkbox" className="sr-only" checked={p.isActive} onChange={(e) => handlePriceChange(idx, 'isActive', e.target.checked)} />
                        </label>
                      )}
                    </div>

                    {/* Card Body */}
                    {p.enabled && (
                      <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Currency & Amount */}
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-nexus-text-secondary uppercase tracking-wider mb-1">Amount *</label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-nexus-muted font-bold">{currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''}</span>
                                <input 
                                  type="text" inputMode="decimal"
                                  placeholder="0.00"
                                  className={classNames("w-full bg-nexus-card border rounded-lg p-2 pl-7 pr-12 text-sm font-bold focus:outline-none transition-colors", fieldErrors[`price-${idx}-amount`] ? "border-red-500/50 focus:border-red-500/50 text-red-400" : "border-nexus-border focus:border-nexus-primary")}
                                  value={p.amount} 
                                  onChange={(e) => handlePriceChange(idx, 'amount', e.target.value)} 
                                />
                                <span className="absolute right-3 text-xs text-nexus-muted font-semibold">{currency}</span>
                              </div>
                              {fieldErrors[`price-${idx}-amount`] && <p className="text-[10px] text-red-400 mt-1">{fieldErrors[`price-${idx}-amount`]}</p>}
                            </div>
                          </div>
  
                          {/* Original Price & Discount */}
                          <div className="flex items-start gap-3 mt-4">
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold text-nexus-text-secondary uppercase tracking-wider mb-1">Original Price</label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-nexus-muted/50 font-bold">{currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''}</span>
                                <input 
                                  type="text" inputMode="decimal"
                                  placeholder="0.00"
                                  className={classNames("w-full bg-nexus-card/50 border rounded-lg p-2 pl-7 text-sm focus:outline-none transition-colors", fieldErrors[`price-${idx}-originalAmount`] ? "border-red-500/50" : "border-nexus-border focus:border-nexus-primary")}
                                  value={p.originalAmount} 
                                  onChange={(e) => handlePriceChange(idx, 'originalAmount', e.target.value)} 
                                />
                              </div>
                              {fieldErrors[`price-${idx}-originalAmount`] && <p className="text-[10px] text-red-400 mt-1">{fieldErrors[`price-${idx}-originalAmount`]}</p>}
                            </div>
                            
                            <div className="w-24 shrink-0">
                              <label className="block text-[10px] font-bold text-nexus-text-secondary uppercase tracking-wider mb-1">Discount</label>
                              <div className="bg-nexus-card/50 border border-nexus-border/50 rounded-lg p-2 text-sm font-semibold text-emerald-400 text-center">
                                {discountPct}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Trailing Days */}
                        <div className="mt-4 pt-4 border-t border-nexus-border/30">
                          <label className="block text-[10px] font-bold text-nexus-text-secondary uppercase tracking-wider mb-1">Trial / Trailing Days</label>
                          <input 
                            type="text" inputMode="numeric"
                            className={classNames("w-full max-w-[120px] bg-nexus-card border rounded-lg p-2 text-sm focus:outline-none transition-colors", fieldErrors[`price-${idx}-trailingDays`] ? "border-red-500/50" : "border-nexus-border focus:border-nexus-primary")}
                            value={p.trailingDays} 
                            onChange={(e) => handlePriceChange(idx, "trailingDays", e.target.value)} 
                          />
                          <p className="text-[10px] text-nexus-muted mt-1">Customers receive access before the first billing period begins.</p>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 3 - FEATURES & LIMITS */}
          <section className="bg-nexus-card border border-nexus-border rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold">FEATURES & LIMITS</h2>
              <p className="text-xs text-nexus-text-secondary">Choose what this plan includes and configure usage limits.</p>
            </div>

            <div className="space-y-6">
              {Object.keys(groupedFeatures).length === 0 && (
                <div className="text-sm text-nexus-muted text-center py-8">
                  No features available to configure.
                </div>
              )}
              {Object.entries(groupedFeatures).map(([moduleName, moduleFeatures]) => (
                <div key={moduleName} className="border border-nexus-border rounded-xl overflow-hidden">
                  <div className="bg-nexus-bg px-4 py-2 border-b border-nexus-border flex items-center gap-2">
                    <div className="w-1.5 h-3 bg-nexus-primary rounded-sm" />
                    <h3 className="font-bold text-xs uppercase tracking-wider">{moduleName}</h3>
                  </div>
                  
                  <div className="divide-y divide-nexus-border/50">
                    {moduleFeatures.map((f) => {
                      const idx = features.findIndex(feat => feat.featureId === f.featureId);
                      const af = availableFeatures.find(a => a.id === f.featureId);
                      const isExpanded = expandedFeatures[f.featureId];
                      const hasConfig = !!f.configuration && f.configuration !== '{}' && f.configuration !== '';

                      return (
                        <div key={f.featureId} className={classNames("p-4 transition-colors", f.enabled ? "bg-nexus-primary/5" : "hover:bg-nexus-hover/30")}>
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            
                            {/* Feature Info */}
                            <div className="flex items-start gap-3 flex-1">
                              <label className="relative flex items-center mt-1 cursor-pointer">
                                <input type="checkbox" className="sr-only" checked={f.enabled} onChange={(e) => handleFeatureChange(idx, 'enabled', e.target.checked)} />
                                <div className={classNames("w-5 h-5 rounded border flex items-center justify-center transition-colors", f.enabled ? "bg-nexus-primary border-nexus-primary text-black" : "border-nexus-border bg-nexus-bg")}>
                                  {f.enabled && <IconCheck size={14} stroke={3} />}
                                </div>
                              </label>
                              <div>
                                <div className="font-bold text-sm text-nexus-text">{af?.name || f.featureId}</div>
                                <div className="text-[10px] text-nexus-muted mt-0.5 max-w-sm">{af?.description || "No description available"}</div>
                              </div>
                            </div>

                            {/* Controls */}
                            {f.enabled && (
                              <div className="flex flex-wrap items-center gap-3 lg:ml-8 lg:justify-end shrink-0">
                                <div className="flex items-center gap-2 bg-nexus-card border border-nexus-border rounded-lg p-1">
                                  <div className="flex flex-col px-2">
                                    <label className="text-[9px] uppercase font-bold text-nexus-muted">Limit Type</label>
                                    <div className="relative">
                                      <select 
                                        className="w-24 bg-transparent text-xs font-semibold focus:outline-none appearance-none" 
                                        value={f.limitType || ''} 
                                        onChange={(e) => handleFeatureChange(idx, 'limitType', e.target.value)}
                                      >
                                        <option value="">None</option>
                                        <option value="COUNT">Count</option>
                                        <option value="STORAGE">Storage</option>
                                        <option value="USERS">Users</option>
                                        <option value="API_CALLS">API Calls</option>
                                        <option value="CUSTOM">Custom</option>
                                      </select>
                                      <IconChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-nexus-muted pointer-events-none" />
                                    </div>
                                  </div>
                                  <div className="w-px h-6 bg-nexus-border" />
                                  <div className="flex flex-col px-2">
                                    <label className="text-[9px] uppercase font-bold text-nexus-muted">Limit Value</label>
                                    <input 
                                      type="number" 
                                      className="w-16 bg-transparent text-xs font-semibold focus:outline-none" 
                                      placeholder="Unlimited"
                                      value={f.limitValue} 
                                      onChange={(e) => handleFeatureChange(idx, 'limitValue', e.target.value)} 
                                    />
                                  </div>
                                </div>

                                <button 
                                  type="button"
                                  onClick={() => toggleFeatureConfig(f.featureId)}
                                  className={classNames("flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors border", hasConfig ? "bg-[#10D078]/10 text-[#10D078] border-[#10D078]/20" : "bg-nexus-bg text-nexus-text-secondary border-nexus-border hover:bg-nexus-hover")}
                                >
                                  <IconSettings size={14} />
                                  {hasConfig ? 'Configured' : 'Optional Config'}
                                  {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Expanded Configuration */}
                          {f.enabled && isExpanded && (
                            <div className="mt-4 pt-4 border-t border-nexus-border/50 ml-8 animate-in fade-in duration-200">
                              <label className="flex items-center justify-between text-xs font-bold text-nexus-text-secondary mb-2">
                                <span>Advanced Configuration (JSON)</span>
                              </label>
                              <textarea 
                                className={classNames("w-full font-mono text-xs p-3 bg-black/40 border rounded-xl min-h-[100px] focus:outline-none transition-colors", fieldErrors[`feature-${idx}-configuration`] ? "border-red-500/50" : "border-nexus-border focus:border-nexus-primary")} 
                                placeholder="{}"
                                value={f.configuration} 
                                onChange={(e) => handleFeatureChange(idx, 'configuration', e.target.value)} 
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* SECTION 4 - PLAN SUMMARY (Sticky Sidebar) */}
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 shadow-lg relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-primary/5 rounded-bl-full pointer-events-none" />
            
            <h3 className="font-extrabold text-sm tracking-widest text-nexus-muted uppercase mb-4">Plan Summary</h3>
            
            <div className="space-y-4 relative z-10">
              <div>
                <div className="text-xl font-bold break-words">{name || 'Unnamed Plan'}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={classNames("text-[10px] font-bold px-2 py-0.5 rounded-full border", status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-nexus-muted/10 text-nexus-muted border-nexus-muted/20")}>
                    {status}
                  </span>
                  {isPublic && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">PUBLIC</span>}
                  {isDefault && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">DEFAULT</span>}
                </div>
              </div>

              <div className="h-px bg-nexus-border/50" />

              <div>
                <h4 className="text-[10px] font-bold text-nexus-text-secondary uppercase mb-2">Pricing</h4>
                <div className="space-y-2">
                  {prices.map(p => {
                    const label = getIntervalLabel(p.billingInterval).title;
                    if (!p.enabled) {
                      return (
                        <div key={p.billingInterval} className="flex justify-between text-xs opacity-40">
                          <span>{label}</span>
                          <span>—</span>
                        </div>
                      );
                    }
                    return (
                      <div key={p.billingInterval} className="flex justify-between text-xs font-semibold">
                        <span className="text-nexus-text-secondary">{label}</span>
                        <span className="text-[#10D078]">
                          {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''}
                          {p.amount !== '' ? Number(p.amount).toLocaleString() : '0.00'}
                          <span className="text-[9px] text-nexus-muted ml-1">{currency}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-nexus-border/50" />

              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-nexus-text-secondary uppercase">Features Enabled</h4>
                <div className="text-sm font-bold bg-nexus-primary/20 text-nexus-primary px-2 py-0.5 rounded">
                  {enabledFeaturesCount} <span className="text-xs font-normal text-nexus-primary/70">/ {features.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      

    </div>
  );
}
