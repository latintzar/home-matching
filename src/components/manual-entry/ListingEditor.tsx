'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Upload, Plus, X, Camera, Sparkles, MapPin, Home, Ruler, FileText, Image as ImageIcon, Link as LinkIcon, StickyNote, AlertTriangle, Building, Check } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { ListingReviewMode } from './ListingReviewMode';

interface PhotoUpload {
  file?: File;
  previewUrl: string;
  label: string;
  uploadedUrl?: string;
  isFromUrl?: boolean; // Track if photo came from URL import
}

// Compatible property types in Spanish (Idealista Aligned)
const PROPERTY_SUBTYPES = [
  { value: 'flat', label: 'Flat / Piso' },
  { value: 'penthouse', label: 'Penthouse / Ático' },
  { value: 'duplex', label: 'Duplex / Dúplex' },
  { value: 'studio', label: 'Studio / Estudio' },
  { value: 'chalet_detached', label: 'Detached House / Chalet Independiente' },
  { value: 'chalet_semi', label: 'Semi-Detached / Chalet Pareado' },
  { value: 'chalet_terraced', label: 'Terraced / Chalet Adosado' },
  { value: 'rustic', label: 'Rustic Property / Finca Rústica' },
];

const HOUSING_SITUATIONS = [
  { value: 'free', label: 'Free (Standard)' },
  { value: 'rented', label: 'Rented (With Tenants)' },
  { value: 'bare_ownership', label: 'Bare Ownership (Nuda Propiedad)' },
  { value: 'squatted', label: 'Squatted (Okupado)' },
  { value: 'auction', label: 'Auction' },
];

const AD_ORIGINS = [
  { value: 'standard', label: 'Standard (Private/Agency)' },
  { value: 'bank', label: 'Bank Owned (De Banco)' },
];

// Brand Configuration for Chameleon UI
const BRAND_CONFIG: Record<string, { color: string; logo: string; name: string; textColor?: string }> = {
  'idealista.com': { color: '#B9E538', logo: 'https://www.google.com/s2/favicons?domain=idealista.com&sz=64', name: 'Idealista', textColor: 'black' }, // Lime Green
  'fotocasa.es': { color: '#E03C31', logo: 'https://www.google.com/s2/favicons?domain=fotocasa.es&sz=64', name: 'Fotocasa' }, // Red
  'habitaclia.com': { color: '#FF6600', logo: 'https://www.google.com/s2/favicons?domain=habitaclia.com&sz=64', name: 'Habitaclia' }, // Orange
  'tecnocasa.es': { color: '#009933', logo: 'https://www.google.com/s2/favicons?domain=tecnocasa.es&sz=64', name: 'Tecnocasa' }, // Green
  'remax.es': { color: '#DC1C2E', logo: 'https://www.google.com/s2/favicons?domain=remax.es&sz=64', name: 'Remax' }, // Red
  'century21.es': { color: '#BEAF87', logo: 'https://www.google.com/s2/favicons?domain=century21.es&sz=64', name: 'Century 21', textColor: 'black' }, // Gold
  'savills.es': { color: '#FFF200', logo: 'https://www.google.com/s2/favicons?domain=savills.es&sz=64', name: 'Savills', textColor: '#cb0b13' }, // Yellow with Red Text
  'savills.com': { color: '#FFF200', logo: 'https://www.google.com/s2/favicons?domain=savills.com&sz=64', name: 'Savills', textColor: '#cb0b13' }, // Yellow with Red Text
  'engelvoelkers.com': { color: '#FF0000', logo: 'https://www.google.com/s2/favicons?domain=engelvoelkers.com&sz=64', name: 'Engel & Völkers' }, // Red
  'lucasfox.com': { color: '#1A1A1A', logo: 'https://www.google.com/s2/favicons?domain=lucasfox.com&sz=64', name: 'Lucas Fox' }, // Black
  'lucasfox.es': { color: '#1A1A1A', logo: 'https://www.google.com/s2/favicons?domain=lucasfox.es&sz=64', name: 'Lucas Fox' }, // Black
};

const getBrandConfig = (url: string) => {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    const domain = Object.keys(BRAND_CONFIG).find(d => hostname.includes(d));
    return domain ? BRAND_CONFIG[domain] : null;
  } catch {
    return null;
  }
};

export default function ListingEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('basics');
  const basicsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<HTMLDivElement>(null);
  
  // Magic Entry State
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const brand = getBrandConfig(importUrl); // Chameleon Brand Detection

  // Form State
  const [formData, setFormData] = useState({
    title: '', // Hidden, auto-generated for backend
    source_url: '', // Preserve source URL for updates
    listing_type: 'sale',
    property_subtype: 'flat', // Default to Flat
    housing_situation: 'free', // Default to Free
    ad_origin: 'standard', // Default
    price_eur: '',
    price_period: 'total',
    city: '',
    address: '',
    region: '',
    lat: null as number | null,
    lng: null as number | null,
    description: '',
    bedrooms: '',
    bathrooms: '',
    m2_built: '',
    m2_useful: '',
    amenities: [] as string[],
    newAmenity: '',
    // Advanced Specs
    floor_level: 'intermediate', // ground, intermediate, top
    floor_number: '', // Actual number
    has_elevator: false,
    is_exterior: true,
    has_terrace: false,
    terrace_orientation: 'unknown',
    has_balcony: false,
    balcony_orientation: 'unknown',
    has_pool: false,
    has_garage: false,
    has_garden: false,
    has_air_conditioning: false,
    has_wardrobes: false,
    is_accessible: false,
    has_storage: false,
    condition: 'good', // new, good, renovate
    notes: '', // Personal notes
    reference: '', // Property Reference ID
    agency: { name: '', logo_url: '', email: '', phone: '', whatsapp: '' }
  });

  const [showAgencySection, setShowAgencySection] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isLocationResolved, setIsLocationResolved] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false); // Show review UI when from extension

  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<{
    description: string;
    place_id: string;
    lat: number;
    lng: number;
    city?: string;
    state?: string;
    country?: string;
  }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [ignoreNextAddressUpdate, setIgnoreNextAddressUpdate] = useState(false); // Prevent loop
  
  // Photo Label Autocomplete State
  const [photoLabelSuggestions, setPhotoLabelSuggestions] = useState<string[]>([
    'General', 'Living Room', 'Kitchen', 'Bathroom', 'Bedroom', 'Exterior', 'Floorplan', 'Certificate'
  ]);
  const [editingPhotoLabel, setEditingPhotoLabel] = useState<number | null>(null);
  const [photoLabelInput, setPhotoLabelInput] = useState('');
  const [activeLabelIndex, setActiveLabelIndex] = useState(-1);

  // Check for load/edit parameter
  const hasLoadedRef = useRef<string | null>(null);
  const hasHydrated = useRef(false);

  useEffect(() => {
    console.log(`[ListingEditor] 🔄 Component Mounted at ${new Date().toISOString()}`);
    const params = new URLSearchParams(window.location.search);
    const importMode = params.get('import');

    if (importMode === 'extension') {
        console.log('[ListingEditor] 🚀 Checking for extension handoff...');
        // We can't talk to extension directly from web page easily without "externally_connectable"
        // But we can listen for window messages if the extension content script injects it?
        // NO, the extension content script runs on THIS page too if we match the URL!
        
        // Strategy: 
        // The extension content script should detect we are on /add-property?import=extension
        // And ask background for the data, then inject it via window.postMessage
        
        const handleMessage = (event: MessageEvent) => {
            // Prevent duplicate handling if we already hydrated
            if (hasHydrated.current) return;

            if (event.data && event.data.type === 'LEO_EXTENSION_HANDOFF') {
                console.log('[ListingEditor] 📦 Received handoff data!');
                hasHydrated.current = true; // LOCK: Only hydrate once
                
                // ⚡ CRITICAL: Use requestAnimationFrame to avoid blocking main thread
                // This prevents the "message handler took Xms" violations
                requestAnimationFrame(() => {
                    const payload = event.data.payload;
                    const sourceData = payload.extractedMetadata || payload;
                    
                    // 🎨 Enable Review Mode for extension imports
                    setIsReviewMode(true);
                    
                    // Handle Photos FIRST (before expensive streamDataToForm)
                    const photosList = sourceData.photos || sourceData.image_urls;
                    if (Array.isArray(photosList) && photosList.length > 0) {
                        console.log(`[ListingEditor] 📸 Streamed ${photosList.length} photos from handoff`);
                        const streamedPhotos: PhotoUpload[] = photosList.map((url: string | any) => {
                            const finalUrl = typeof url === 'string' ? url : url.url;
                            return {
                                previewUrl: finalUrl,
                                label: '',
                                uploadedUrl: finalUrl,
                                isFromUrl: true
                            };
                        });
                        setPhotos(streamedPhotos); // Replace, don't append
                    }
                    
                    // Then populate form (async, will resolve location in background)
                    streamDataToForm(sourceData);
                });
            }
        };
        
        window.addEventListener('message', handleMessage);

        // 📢 Handshake: Tell the content script we are ready to receive data
        // This fixes the race condition where content script fires before we are listening
        console.log('[ListingEditor] 📢 Announcing readiness to extension...');
        const announceReady = () => window.postMessage({ type: 'LEO_EDITOR_READY' }, '*');
        
        // Announce immediately and then a few times to be safe
        if (!hasHydrated.current) {
            announceReady();
            const interval = setInterval(() => {
                if (!hasHydrated.current) announceReady();
            }, 500);
            
            // Stop announcing after 3 seconds or when we get data
            const cleanupTimeout = setTimeout(() => clearInterval(interval), 3000);

            return () => {
                window.removeEventListener('message', handleMessage);
                clearInterval(interval);
                clearTimeout(cleanupTimeout);
            };
        }
    }

    const id = params.get('load') || params.get('edit'); // Support both load and edit params
    const autoStart = params.get('auto_start') === 'true';
    
    if (id && hasLoadedRef.current !== id) {
      hasLoadedRef.current = id;
      loadListing(id, autoStart);
    }
  }, [searchParams]); // Re-run if params change

  const loadListing = async (id: string, autoStart: boolean = false) => {
    try {
      console.time('loadListing');
      console.log(`[ListingEditor] 🕒 Starting loadListing for ID: ${id} at ${new Date().toISOString()}`);
      
      setIsImporting(true);
      setLoadingMessage('Loading listing data...');
      
      const res = await fetch(`/api/listings/${id}`);
      console.log(`[ListingEditor] 📥 Received listing data at ${new Date().toISOString()}`);
      
      if (!res.ok) throw new Error('Failed to fetch listing');
      
      const listing = await res.json();
      console.timeEnd('loadListing');
      console.log('Listing Data Loaded:', listing);
      
      // 1. Populate form text IMMEDIATELY (Don't wait for photos)
      const sourceData = listing.scraped_data || listing;
      const isSavedListing = !!listing.address && listing.address.length > 5 && listing.source_url !== 'manual_entry';
      console.log(`[ListingEditor] ⚡ Populating form at ${new Date().toISOString()}`, 'Skip Resolution:', isSavedListing);
      
      await streamDataToForm(sourceData, isSavedListing);
      console.log(`[ListingEditor] ✅ Form population complete at ${new Date().toISOString()}`);
      
      // If auto-start, trigger submission logic
      if (autoStart) {
          console.log('🚗 Auto-Start requested...');
          setAutoSubmit(true);
      }
      
      // Also set basic fields directly just in case streamData misses some
      setFormData(prev => ({
        ...prev,
        title: listing.title || prev.title,
        source_url: listing.source_url || prev.source_url,
        price_eur: (listing.price_eur || sourceData.price || sourceData.price_eur || prev.price_eur).toString(),
        description: listing.description || listing.scraped_data?.description || prev.description,
        reference: listing.reference_number || listing.scraped_data?.reference || prev.reference,
        listing_type: listing.listing_type || sourceData.listing_type || prev.listing_type,
        bedrooms: (listing.bedrooms || sourceData.bedrooms || prev.bedrooms).toString(),
        bathrooms: (listing.bathrooms || sourceData.bathrooms || prev.bathrooms).toString(),
        m2_built: (listing.m2_built || sourceData.m2_built || prev.m2_built).toString(),
        m2_useful: (listing.m2_useful || sourceData.m2_useful || prev.m2_useful).toString(),
        
        // Advanced Filters
        property_subtype: listing.property_subtype || sourceData.property_subtype || prev.property_subtype,
        housing_situation: listing.housing_situation || sourceData.housing_situation || prev.housing_situation,
        ad_origin: listing.ad_origin || sourceData.ad_origin || prev.ad_origin,
        
        // Booleans
        has_air_conditioning: listing.has_air_conditioning || sourceData.has_air_conditioning || prev.has_air_conditioning,
        has_wardrobes: listing.has_wardrobes || sourceData.has_wardrobes || prev.has_wardrobes,
        is_accessible: listing.is_accessible || sourceData.is_accessible || prev.is_accessible,
        has_storage: listing.has_storage || sourceData.has_storage || prev.has_storage,
        has_garden: listing.has_garden || sourceData.has_garden || prev.has_garden,
      }));

      // 2. Load photos in parallel (Non-blocking)
      fetch(`/api/listings/${id}/photos`)
        .then(res => res.json())
        .then(photosData => {
            let existingPhotos: PhotoUpload[] = [];
            if (photosData.photos && photosData.photos.length > 0) {
                existingPhotos = photosData.photos.map((p: any) => ({
                    previewUrl: p.url,
                    label: p.label || p.tag || '',
                    uploadedUrl: p.url,
                    isFromUrl: true
                }));
            } else {
                // FALLBACK: Use scraped_data.photo_urls if no storage photos yet (Instant "Fake" Mode)
                const scrapedUrls = listing.scraped_data?.photo_urls || listing.scraped_data?.photos || listing.scraped_data?.image_urls;
                if (Array.isArray(scrapedUrls) && scrapedUrls.length > 0) {
                    console.log('Using fallback URLs from scraped_data (Instant Mode)');
                    existingPhotos = scrapedUrls.map((url: string) => ({
                        previewUrl: url,
                        label: '',
                        uploadedUrl: url,
                        isFromUrl: true
                    }));
                }
            }
            setPhotos(existingPhotos);
        })
        .catch(err => console.error('Error fetching photos:', err));

    } catch (error) {
      console.error('Error loading listing:', error);
      alert('Failed to load listing data.');
    } finally {
      setIsImporting(false);
    }
  };

  // Streaming Effect for Magic Entry
  const streamDataToForm = async (data: any, skipResolution: boolean = false) => {
    setIgnoreNextAddressUpdate(true); // LOCK: Prevent autocomplete from firing on programmatic update

    // Determine if we need to resolve location
    // We resolve if we have coordinates (reverse geocode) OR if we have a query/address to autocomplete
    // BUT: If skipResolution is true (e.g. loading saved listing), we skip expensive API calls
    const hasCoordinates = data.lat && data.lng;
    const hasAddressToResolve = data.autocomplete_query || data.address || data.title;
    const shouldResolve = !skipResolution && (hasCoordinates || hasAddressToResolve);

    if (shouldResolve) {
        setIsResolvingLocation(true);
    }

    const fieldsToFill = [
      { key: 'listing_type', value: data.listing_type || 'sale' },
      { key: 'price_eur', value: (data.price_eur || data.price || '').toString() },
      { key: 'price_period', value: data.price_period || 'total' },
      // SKIP location fields here if we are resolving them
      { key: 'city', value: shouldResolve ? '' : (data.city || '') },
      { key: 'address', value: shouldResolve ? '' : (data.address || '') },
      { key: 'region', value: shouldResolve ? '' : (data.region || '') },
      
      { key: 'description', value: data.description || '' },
      { key: 'bedrooms', value: (data.bedrooms || '').toString() },
      { key: 'bathrooms', value: (data.bathrooms || '').toString() },
      { key: 'm2_built', value: (data.m2_built || data.areas?.constructed || '').toString() },
      { key: 'm2_useful', value: (data.m2_useful || data.areas?.useful || '').toString() },
      { key: 'reference', value: data.reference || '' },
      { key: 'floor_level', value: data.floor_level || 'intermediate' },
      { key: 'floor_number', value: (data.floor_number || '').toString() },
      { key: 'condition', value: data.condition || 'good' },
      { key: 'property_subtype', value: data.property_subtype || 'flat' },
      { key: 'housing_situation', value: data.housing_situation || 'free' },
      { key: 'ad_origin', value: data.ad_origin || 'standard' },
      { key: 'balcony_orientation', value: data.balcony_orientation || 'unknown' },
      { key: 'terrace_orientation', value: data.terrace_orientation || 'unknown' },
    ];

    // Instant update
    const updates: any = {};
    for (const field of fieldsToFill) {
      if (field.value) updates[field.key] = field.value;
    }
    
    // Map Booleans (Expanded)
    const boolFields = [
      'has_elevator', 'is_exterior', 'has_terrace', 'has_balcony', 
      'has_pool', 'has_garage', 'has_garden',
      'has_air_conditioning', 'has_wardrobes', 'is_accessible', 'has_storage'
    ];
    boolFields.forEach(k => {
        if (data[k] !== undefined) updates[k] = data[k];
    });
    
    setFormData(prev => ({ ...prev, ...updates }));
    
    const feats = data.additionalFeatures || data.features;
    if (feats) {
      setFormData(prev => ({ ...prev, amenities: feats }));
    }

    if (data.agency) {
      setFormData(prev => ({ 
        ...prev, 
        agency: {
          name: data.agency.name || '',
          logo_url: data.agency.logo_url || '',
          email: data.agency.email || data.agency_email || '',
          phone: data.agency.phone || data.agency_phone || '',
          whatsapp: data.agency.whatsapp || data.whatsapp || ''
        }
      }));
      setShowAgencySection(true);
    }

    // Handle Photos from Magic Entry / Stream
    const photosList = data.photo_urls || data.photos || data.image_urls;
    if (Array.isArray(photosList) && photosList.length > 0) {
      console.log(`📸 Streamed ${photosList.length} photos`);
      const streamedPhotos: PhotoUpload[] = photosList.map((url: string | any) => {
        const finalUrl = typeof url === 'string' ? url : url.url;
        return {
          previewUrl: finalUrl,
          label: '',
          uploadedUrl: finalUrl,
          isFromUrl: true
        };
      });
      
      // Replace or append? Append to avoid overwriting user uploads if mixed
      setPhotos(prev => {
        // Avoid duplicates by checking URL
        const existingUrls = new Set(prev.map(p => p.uploadedUrl));
        const newPhotos = streamedPhotos.filter(p => p.uploadedUrl && !existingUrls.has(p.uploadedUrl));
        return [...prev, ...newPhotos];
      });
    }

    // Geocoding & Autocomplete Logic
    if (!shouldResolve) return;

    try {
        // Strategy 1: Reverse Geocode (High Precision if Lat/Lng exists)
        if (hasCoordinates) {
        try {
            console.log(`📍 Reverse geocoding: ${data.lat}, ${data.lng}`);
            const geoRes = await fetch(`/api/places/reverse-geocode?lat=${data.lat}&lng=${data.lng}`);
            const geoData = await geoRes.json();
            if (geoData.address) {
                     // Update with clean reverse-geocoded address
                 setFormData(prev => ({ 
                     ...prev, 
                     address: geoData.address, 
                         city: geoData.city || prev.city || data.city,
                         region: geoData.region || prev.region || data.region,
                         lat: data.lat,
                         lng: data.lng
                     }));
                     setTimeout(() => setIgnoreNextAddressUpdate(false), 500);
                     return; // Done
            }
        } catch (e) {
            console.warn('Reverse geocoding failed:', e);
        }
    }

        // Strategy 2: AI Clean + Autocomplete Search & Auto-Select First
        // Use autocomplete_query if available (extension provides this), otherwise raw address/title
        const rawQuery = data.autocomplete_query || data.address || data.title;
        console.log(`🔍 Address resolution: autocomplete_query="${data.autocomplete_query}", address="${data.address}", title="${data.title?.substring(0, 50)}..."`);
        console.log(`🔍 Using rawQuery: "${rawQuery}"`);
    
        if (rawQuery) { 
            try {
                // Step 1: Clean the address with Flash Lite (AI)
                let queryToSearch = rawQuery;
                
                // OPTIMIZATION: Skip cleaning if query is already simple/short (no property type words)
                const hasPropertyType = /piso|ático|casa|chalet|apartamento|flat|apartment|house|villa/i.test(rawQuery);
                const isSimpleAddress = rawQuery.length < 50 && !rawQuery.includes('venta') && !rawQuery.includes('sale') && !hasPropertyType;
                
                if (!isSimpleAddress) {
                try {
                  const cleanRes = await fetch('/api/ai/clean-address', {
                    method: 'POST',
                    body: JSON.stringify({ address: rawQuery })
                  });
                  if (cleanRes.ok) {
                    const cleanData = await cleanRes.json();
                    if (cleanData.cleaned) {
                      queryToSearch = cleanData.cleaned;
                    }
                  }
                } catch (cleanErr) {
                        console.warn('Address cleaning failed, using raw query');
                    }
                }

                // Force UI reset to empty while searching to show skeleton
                setFormData(prev => ({ ...prev, address: '' }));

                // Step 2: Autocomplete with refined query
                const getAutocompleteUrl = (q: string) => `/api/places/autocomplete?input=${encodeURIComponent(q)}`;
                const res = await fetch(getAutocompleteUrl(queryToSearch));
            const autoData = await res.json();
            
                // Step 3: Auto-select first result
            if (autoData.predictions && autoData.predictions.length > 0) {
                    const firstSuggestion = autoData.predictions[0];
                        // 🔥 Fix: Check if we already have a resolved address to avoid loop/overwrite
                        // if (!isLocationResolved) ...
                        
                        selectAddress(firstSuggestion); 
            } else {
                     // Fallback: Just set the cleaned text if no predictions found
                     setFormData(prev => ({ 
                         ...prev, 
                         address: queryToSearch,
                         city: prev.city || data.city || '', // Restore original if no new info
                         region: prev.region || data.region || ''
                     }));
            }
        } catch (e) {
            console.warn('Failed to auto-match scraped address', e);
                // Final fallback
                setFormData(prev => ({ 
                    ...prev, 
                    address: rawQuery,
                    city: prev.city || data.city || '',
                    region: prev.region || data.region || ''
                }));
            }
        } else {
            // No query to resolve, restore original data
             setFormData(prev => ({ 
                ...prev, 
                address: data.address || '',
                city: prev.city || data.city || '',
                region: prev.region || data.region || ''
            }));
        }
    } finally {
        setIsResolvingLocation(false);
        setTimeout(() => setIgnoreNextAddressUpdate(false), 500); // Ensure lock is released
    }
  };

  // Faster debounce for instant feel (150ms)
  const debouncedAddress = useDebounce(formData.address, 150);

  // Fetch suggestions when debounced address changes
  useEffect(() => {
    // If we programmatically updated the address, DO NOT fetch suggestions
    if (ignoreNextAddressUpdate || isResolvingLocation || isLocationResolved) {
        return;
    }

    const fetchSuggestions = async () => {
      if (debouncedAddress.length >= 2) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
          
          const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(debouncedAddress)}`, {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          
          const data = await res.json();
          setSuggestions(data.predictions || []);
          setActiveSuggestionIndex(-1); // Reset selection
          setShowSuggestions(true); // Show when we have results
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.warn('Autocomplete failed', error);
            setSuggestions([]);
          }
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
      fetchSuggestions();
  }, [debouncedAddress, ignoreNextAddressUpdate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        
        // Auto-reset floor number for ground/mezzanine
        if (name === 'floor_level') {
            if (['ground', 'mezzanine'].includes(value)) {
                newData.floor_number = ''; // Or '0'/'0.5' if we prefer strict values
            }
        }
        return newData;
    });
  };

  const formatPrice = (val: string) => {
    if (!val) return '';
    return val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue && !/^\d*$/.test(rawValue)) return; // Only allow digits
    setFormData(prev => ({ ...prev, price_eur: rawValue }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIgnoreNextAddressUpdate(false); // User is typing, so allow updates
    setIsLocationResolved(false); // Reset resolved status on manual edit
    setFormData(prev => ({ ...prev, address: value }));
    if (value.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0) {
        selectAddress(suggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const selectAddress = (suggestion: any) => {
    const city = suggestion.city || suggestion.state || ''; 
    const region = suggestion.state || suggestion.country || '';
    
    console.log(`📍 Selecting address:`, {
      description: suggestion.description,
      city,
      region
    });
    
    setIgnoreNextAddressUpdate(true); // Prevent re-fetching suggestions on selection
    setIsLocationResolved(true);
    setFormData(prev => ({ 
      ...prev, 
      address: suggestion.description || '',
      city: prev.city || city || '', 
      region: prev.region || region || '',
      lat: suggestion.lat || null,
      lng: suggestion.lng || null
    }));
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    setTimeout(() => setIgnoreNextAddressUpdate(false), 500); // Release lock
  };

  const handleAddAmenity = async () => {
    if (formData.newAmenity.trim()) {
      const input = formData.newAmenity.trim();
      if (input.includes(',') || input.length > 30) {
        try {
          const res = await fetch('/api/ai/parse-amenities', { method: 'POST', body: JSON.stringify({ text: input }) });
          const data = await res.json();
          if (data.amenities && data.amenities.length > 0) {
             setFormData(prev => ({ ...prev, amenities: [...prev.amenities, ...data.amenities], newAmenity: '' }));
            return;
          }
        } catch (e) {
          console.warn('AI amenities parsing failed, falling back to simple split');
        }
        const parts = input.split(',').map(s => s.trim()).filter(Boolean);
        setFormData(prev => ({ ...prev, amenities: [...prev.amenities, ...parts], newAmenity: '' }));
      } else {
        setFormData(prev => ({ ...prev, amenities: [...prev.amenities, input], newAmenity: '' }));
      }
    }
  };

  const removeAmenity = (index: number) => {
    setFormData(prev => ({ ...prev, amenities: prev.amenities.filter((_, i) => i !== index) }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: PhotoUpload[] = Array.from(e.target.files).map(file => ({
        file,
        previewUrl: URL.createObjectURL(file),
        label: '',
        isFromUrl: false
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const updatePhotoLabel = (index: number, label: string) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, label } : p));
    if (label.trim() && !photoLabelSuggestions.includes(label.trim())) {
      setPhotoLabelSuggestions(prev => [...prev, label.trim()]);
    }
    setEditingPhotoLabel(null);
    setPhotoLabelInput('');
  };

  const startEditingPhotoLabel = (index: number) => {
    setEditingPhotoLabel(index);
    setPhotoLabelInput(photos[index].label);
  };

  const handlePhotoLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    const filtered = photoLabelSuggestions.filter(s => s.toLowerCase().includes(photoLabelInput.toLowerCase()));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveLabelIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveLabelIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeLabelIndex >= 0 && filtered[activeLabelIndex]) {
        updatePhotoLabel(index, filtered[activeLabelIndex]);
      } else if (photoLabelInput.trim()) {
        updatePhotoLabel(index, photoLabelInput.trim());
      }
    } else if (e.key === 'Escape') {
      setEditingPhotoLabel(null);
      setPhotoLabelInput('');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const [loadingMessage, setLoadingMessage] = useState('Importing...');
  useEffect(() => {
    if (isImporting) {
      const messages = ['Connecting...', 'Analyzing...', 'Extracting photos...', 'Translating...', 'Normalizing...', 'Almost there...'];
      let i = 0;
      setLoadingMessage(messages[0]);
      const interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setLoadingMessage(messages[i]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isImporting]);

  const handleMagicImport = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/ingest/server', { method: 'POST', body: JSON.stringify({ url: importUrl, preview: true }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to import listing');
      
      const result = await res.json();
      const { data } = result;
      await streamDataToForm(data);

      if (result.photos && Array.isArray(result.photos)) {
        const scrapedPhotos: PhotoUpload[] = result.photos.map((p: any) => ({
          previewUrl: p.url,
          label: '',
          uploadedUrl: p.url,
          isFromUrl: true
        }));
        setPhotos(prev => [...prev, ...scrapedPhotos]);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import from URL. Please try manual entry.');
    } finally {
      setIsImporting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Auto-Submit Effect
  useEffect(() => {
    if (autoSubmit && !isSubmitting && formData.title) {
        console.log('🚗 executing Auto-Submit...');
        handleSubmit();
        setAutoSubmit(false);
    }
  }, [autoSubmit, formData, isSubmitting]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log(`[ListingEditor] 🖱️ Submit Clicked at ${new Date().toISOString()}`);
    setIsSubmitting(true);

    try {
      let finalTitle = formData.title;
      if (!finalTitle) {
        const shortAddress = formData.address.split(',')[0] || 'Location';
        const typeLabel = PROPERTY_SUBTYPES.find(t => t.value === formData.property_subtype)?.label || 'Property';
        finalTitle = `${typeLabel} in ${shortAddress}`;
      }

      // 1. Create Listing Record
      const payload = {
        id: editId || undefined, // Send ID for updates
        title: finalTitle,
        source_url: formData.source_url || importUrl || 'manual_entry',
        photo_urls: photos.map(p => p.uploadedUrl).filter(Boolean), // Pass scraped URLs
        price_eur: parseInt(formData.price_eur) || 0,
        listing_type: formData.listing_type,
        property_subtype: formData.property_subtype,
        housing_situation: formData.housing_situation,
        ad_origin: formData.ad_origin,
        price_period: formData.price_period,
        city: formData.city,
        address: formData.address,
        region: formData.region,
        lat: formData.lat,
        lng: formData.lng,
        description: formData.description,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) || null : null,
        bathrooms: formData.bathrooms ? parseFloat(formData.bathrooms) || null : null,
        m2_built: formData.m2_built ? parseInt(formData.m2_built) || null : null,
        areas: {
          constructed: formData.m2_built ? parseInt(formData.m2_built) || null : null,
          useful: formData.m2_useful ? parseInt(formData.m2_useful) || null : null
        },
        additionalFeatures: formData.amenities,
        // Advanced Specs
        floor_level: formData.floor_level,
        floor_number: formData.floor_number ? parseInt(formData.floor_number) || null : null,
        has_elevator: formData.has_elevator,
        is_exterior: formData.is_exterior,
        has_terrace: formData.has_terrace,
        terrace_orientation: formData.terrace_orientation,
        has_balcony: formData.has_balcony,
        balcony_orientation: formData.balcony_orientation,
        has_pool: formData.has_pool,
        has_garage: formData.has_garage,
        has_garden: formData.has_garden,
        has_air_conditioning: formData.has_air_conditioning,
        has_wardrobes: formData.has_wardrobes,
        is_accessible: formData.is_accessible,
        has_storage: formData.has_storage,
        condition: formData.condition,
        
        notes: formData.notes,
        reference_number: formData.reference,
        agency: formData.agency.name ? formData.agency : null
      };

      const res = await fetch('/api/listings/manual', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload) 
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      
      const { listingId } = await res.json();
      console.log(`[ListingEditor] ✅ Saved listing ${listingId} at ${new Date().toISOString()}`);

      const uploadPromises = photos.map(async (photo) => {
        if (photo.file) {
            const data = new FormData();
            data.append('file', photo.file);
            data.append('label', photo.label);
            await fetch(`/api/listings/${listingId}/photos`, { method: 'POST', body: data });
        } else if (photo.uploadedUrl) {
            console.log('Saving scraped photo URL:', photo.uploadedUrl);
        }
      });
      await Promise.all(uploadPromises);
      console.log(`[ListingEditor] 🚀 Redirecting to analysis at ${new Date().toISOString()}`);
      
      router.push(`/property/${listingId}/analyze?auto=true`);
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error?.message || 'Failed to save listing. Please check the console for details.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🎨 Review Mode: Show beautiful preview when from extension
  if (isReviewMode) {
    const reviewPhotos = photos.map(p => ({ url: p.previewUrl || p.uploadedUrl || '', label: p.label }));
    const reviewData = {
      title: formData.title || 'Property Listing',
      address: formData.address,
      city: formData.city,
      region: formData.region,
      price_eur: parseInt(formData.price_eur) || 0,
      bedrooms: parseInt(formData.bedrooms) || 0,
      bathrooms: parseInt(formData.bathrooms) || 0,
      m2_built: parseInt(formData.m2_built) || 0,
      m2_useful: parseInt(formData.m2_useful) || 0,
      description: formData.description,
      source_url: formData.source_url,
      reference: formData.reference,
      floor_level: formData.floor_level,
      floor_number: parseInt(formData.floor_number) || 0,
      condition: formData.condition,
      property_subtype: formData.property_subtype,
      has_elevator: formData.has_elevator,
      is_exterior: formData.is_exterior,
      has_terrace: formData.has_terrace,
      has_balcony: formData.has_balcony,
      has_pool: formData.has_pool,
      has_garage: formData.has_garage,
      has_garden: formData.has_garden,
      has_air_conditioning: formData.has_air_conditioning,
      agency: formData.agency,
    };
    
    const handleAnalyseWithNotes = (notes: string) => {
      // Update notes in formData before submitting
      setFormData(prev => ({ ...prev, notes }));
      // Small delay to ensure state is updated
      setTimeout(() => handleSubmit(), 50);
    };
    
    return (
      <ListingReviewMode
        data={reviewData}
        photos={reviewPhotos}
        isResolvingLocation={isResolvingLocation}
        isLocationResolved={isLocationResolved}
        onEdit={() => setIsReviewMode(false)}
        onAnalyse={handleAnalyseWithNotes}
        isSubmitting={isSubmitting}
        initialNotes={formData.notes}
      />
    );
  }

  return (
    <div className="min-h-screen h-screen overflow-hidden bg-[#FDFBF7] flex flex-col">
      {/* Header - Same as Review Mode */}
      <header className="flex-shrink-0 bg-[#FDFBF7] border-b border-stone-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl font-medium tracking-tight text-stone-900">Leo.casa</span>
          </div>
          {formData.source_url && formData.source_url !== 'manual_entry' && (
            <a
              href={formData.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1.5 transition-colors"
            >
              <LinkIcon className="h-4 w-4" />
              View Original
            </a>
          )}
        </div>
      </header>
      
      {/* Main Content - Same Layout as Review Mode */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-6 h-full">
          <div className="flex gap-6 h-full">
            {/* Left: Scrollable Form Content */}
            <div className="flex-1 min-w-0 overflow-y-auto pr-2 pb-6 space-y-6">
          
              {/* Section Header */}
          <div>
                <h2 className="text-xl font-serif font-medium text-stone-900 mb-1">Edit Property Details</h2>
                <p className="text-sm text-stone-500">Make changes and click Analyse when ready.</p>
          </div>
          
          {/* BASICS SECTION */}
              <div id="basics" ref={basicsRef}>
            <Card className="border border-stone-100 shadow-sm bg-white overflow-visible">
              <div className="h-1 bg-[#da654d] w-full" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-[#da654d]" /> Basic Info</CardTitle>
                <CardDescription>Location, pricing, and status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Listing Type</Label>
                    <div className="flex gap-2 p-1 bg-stone-100 rounded-lg">
                      <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.listing_type === 'sale' ? 'bg-white shadow-sm text-[#da654d]' : 'text-stone-500 hover:text-gray-700'}`} onClick={() => setFormData(p => ({ ...p, listing_type: 'sale', price_period: 'total' }))}>For Sale</button>
                      <button className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formData.listing_type === 'rent' ? 'bg-white shadow-sm text-[#da654d]' : 'text-stone-500 hover:text-gray-700'}`} onClick={() => setFormData(p => ({ ...p, listing_type: 'rent', price_period: 'month' }))}>For Rent</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Asking Price</Label>
                    <div className="relative">
                      <Input name="price_eur" type="text" value={formatPrice(formData.price_eur)} onChange={handlePriceChange} className="pl-8 pr-20 font-mono text-lg" placeholder="0" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">€</span>
                      <div className="absolute right-1 top-1 bottom-1 px-3 bg-stone-50 border-l rounded-r text-sm text-stone-500 flex items-center justify-center font-medium pointer-events-none min-w-[80px]">
                        {formData.listing_type === 'rent' ? '/ Month' : 'Total'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reference Number */}
                {formData.reference && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-stone-500">Property Reference</Label>
                    <div className="bg-stone-100 px-3 py-2 rounded-md font-mono text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-stone-400">REF:</span>
                      {formData.reference}
                    </div>
                  </div>
                )}

                {/* Address */}
                <div className="space-y-2 relative z-50">
                  <Label className="flex items-center gap-2">
                    Address
                    {isResolvingLocation && (
                        <span className="text-xs font-normal text-[#da654d] flex items-center animate-pulse">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Auto-completing...
                        </span>
                    )}
                  </Label>
                  <div className="relative z-50" onClick={e => e.stopPropagation()}>
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 z-10" />
                    <Input 
                      name="address" 
                      value={formData.address} 
                      onChange={handleAddressChange}
                      onKeyDown={handleAddressKeyDown}
                      placeholder={isResolvingLocation ? "Resolving precise location..." : "Start typing address..."}
                        className={`pl-9 relative z-10 ${(!formData.address && isImporting) || isResolvingLocation ? 'bg-stone-50 text-transparent select-none' : ''}`} 
                      autoComplete="off"
                      readOnly={isResolvingLocation}
                    />
                    {isResolvingLocation && (
                        <div className="absolute inset-0 bg-stone-50 rounded-md border border-stone-200 flex items-center pl-9 z-20 pointer-events-none">
                            <div className="h-4 w-2/3 bg-stone-200 rounded animate-pulse" />
                        </div>
                    )}
                    {isResolvingLocation && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30">
                            <Loader2 className="h-4 w-4 text-[#da654d] animate-spin" />
                        </div>
                    )}
                    {!isResolvingLocation && isLocationResolved && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-in fade-in zoom-in duration-300">
                           <div className="bg-green-100 text-green-600 rounded-full p-1 shadow-sm">
                              <Check className="h-3 w-3" />
                           </div>
                        </div>
                    )}
                    {isImporting && !formData.address && !isResolvingLocation && (<div className="absolute inset-0 bg-white/50 flex items-center pl-10 z-20 pointer-events-none"><div className="h-4 w-3/4 bg-stone-200 rounded animate-pulse" /></div>)}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-[100] w-full bg-white border rounded-md shadow-xl mt-1 max-h-60 overflow-auto">
                        {suggestions.map((suggestion, i) => (
                          <div key={suggestion.place_id || i} className={`px-4 py-2 cursor-pointer text-sm transition-colors ${i === activeSuggestionIndex ? 'bg-stone-100 text-stone-900 font-medium' : 'hover:bg-stone-50'}`} onClick={() => selectAddress(suggestion)} onMouseEnter={() => setActiveSuggestionIndex(i)}>{suggestion.description}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Critical Status Filters */}
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-lg space-y-4">
                  <div className="flex items-center gap-2 text-orange-700 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" /> Legal & Availability Status
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                        <Label>Housing Situation</Label>
                        <select name="housing_situation" value={formData.housing_situation} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 ring-orange-200 outline-none">
                            {HOUSING_SITUATIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                  </div>
                     <div className="space-y-2">
                        <Label>Origin</Label>
                        <select name="ad_origin" value={formData.ad_origin} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:ring-2 ring-orange-200 outline-none">
                            {AD_ORIGINS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                  </div>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Detailed Property Type</Label>
                    <select name="property_subtype" value={formData.property_subtype} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {PROPERTY_SUBTYPES.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                    </select>
                  </div>
                  <div className="hidden"><Input name="title" value={formData.title} onChange={handleInputChange} /></div>
                </div>
                <div className="hidden"><Input name="city" value={formData.city} readOnly /><Input name="region" value={formData.region} readOnly /></div>
              </CardContent>
            </Card>
          </div>

          {/* DETAILS SECTION */}
            <div id="details" ref={detailsRef}>
            <Card className="border border-stone-100 shadow-sm bg-white overflow-hidden">
              <div className="h-1 bg-[#da654d] w-full" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Ruler className="h-5 w-5 text-[#da654d]" /> Details & Features</CardTitle>
                <CardDescription>Specs, amenities, and condition</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2"><Label>Bedrooms</Label><Input name="bedrooms" type="number" value={formData.bedrooms} onChange={handleInputChange} placeholder="0" /></div>
                  <div className="space-y-2"><Label>Bathrooms</Label><Input name="bathrooms" type="number" value={formData.bathrooms} onChange={handleInputChange} placeholder="0" /></div>
                  <div className="space-y-2"><Label>Built (m²)</Label><Input name="m2_built" type="number" value={formData.m2_built} onChange={handleInputChange} placeholder="0" /></div>
                  <div className="space-y-2"><Label>Useful (m²)</Label><Input name="m2_useful" type="number" value={formData.m2_useful} onChange={handleInputChange} placeholder="0" /></div>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-stone-50 rounded-xl border border-stone-100">
                    <div className="space-y-4">
                  <div className="space-y-2">
                            <Label>Condition</Label>
                            <div className="flex gap-2">
                                {['new', 'good', 'renovate'].map(opt => (
                                    <button key={opt} type="button" onClick={() => setFormData(p => ({ ...p, condition: opt }))} className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${formData.condition === opt ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}>{opt === 'new' ? 'New' : opt === 'good' ? 'Good' : 'Renovate'}</button>
                                ))}
                  </div>
                  </div>
                  <div className="space-y-2">
                            <Label>Floor</Label>
                            <div className="flex gap-2">
                                <select name="floor_level" value={formData.floor_level} onChange={handleInputChange} className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                    <option value="ground">Ground / Bajo</option>
                                    <option value="mezzanine">Mezzanine / Entreplanta</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="top">Top / Ático</option>
                                </select>
                                <Input 
                                    name="floor_number" 
                                    value={formData.floor_number} 
                                    onChange={handleInputChange} 
                                    placeholder="Nº" 
                                    className={`w-20 h-9 text-center ${
                                        ['ground', 'mezzanine'].includes(formData.floor_level || '') 
                                            ? 'opacity-50 bg-gray-50 cursor-not-allowed' 
                                            : ''
                                    }`}
                                    type="number"
                                    readOnly={['ground', 'mezzanine'].includes(formData.floor_level || '')}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { key: 'has_elevator', label: 'Elevator' },
                            { key: 'is_exterior', label: 'Exterior' },
                            { key: 'has_terrace', label: 'Terrace', orientationKey: 'terrace_orientation' },
                            { key: 'has_balcony', label: 'Balcony', orientationKey: 'balcony_orientation' },
                            { key: 'has_garage', label: 'Garage' },
                            { key: 'has_pool', label: 'Pool' },
                            { key: 'has_garden', label: 'Garden' },
                            { key: 'has_air_conditioning', label: 'Air Cond.' },
                            { key: 'has_wardrobes', label: 'Wardrobes' },
                            { key: 'has_storage', label: 'Storage' },
                            { key: 'is_accessible', label: 'Accessible' },
                        ].map(({ key, label, orientationKey }) => (
                            <div key={key} className="flex flex-col gap-2">
                                <div className="flex items-center space-x-2">
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, [key]: !(p as any)[key] }))} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${formData[key as keyof typeof formData] ? 'bg-[#da654d] border-[#da654d]' : 'bg-white border-stone-300'}`}>
                                        {formData[key as keyof typeof formData] && <span className="text-white text-[10px]">✓</span>}
                                    </button>
                                    <Label className="font-normal cursor-pointer text-xs" onClick={() => setFormData(p => ({ ...p, [key]: !(p as any)[key] }))}>{label}</Label>
                                </div>
                                
                                {orientationKey && formData[key as keyof typeof formData] && (
                                    <div className="flex gap-1 ml-6">
                                        <button type="button" onClick={() => setFormData(p => ({ ...p, [orientationKey]: 'street' }))} className={`px-2 py-0.5 text-[10px] rounded border transition-all ${formData[orientationKey as keyof typeof formData] === 'street' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'}`}>Street</button>
                                        <button type="button" onClick={() => setFormData(p => ({ ...p, [orientationKey]: 'back' }))} className={`px-2 py-0.5 text-[10px] rounded border transition-all ${formData[orientationKey as keyof typeof formData] === 'back' ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'}`}>Back</button>
                                    </div>
                                )}
                            </div>
                        ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea name="description" value={formData.description} onChange={handleInputChange} className="min-h-[150px] resize-y" placeholder="Describe the property..." />
                </div>

                <div className="space-y-3">
                  <Label>Other Features</Label>
                  <div className="flex gap-2">
                    <Input name="newAmenity" value={formData.newAmenity} onChange={handleInputChange} placeholder="Add feature or paste list..." onKeyDown={(e) => e.key === 'Enter' && handleAddAmenity()} className="max-w-sm" />
                    <Button type="button" onClick={handleAddAmenity} size="icon" variant="outline"><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-4 bg-stone-50 rounded-lg border border-dashed">
                    {formData.amenities.length === 0 && <span className="text-sm text-stone-400 italic">No amenities added yet</span>}
                    {formData.amenities.map((amenity, idx) => (
                      <span key={idx} className="bg-white border px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm group animate-in fade-in zoom-in duration-200">
                        {amenity}
                        <button onClick={() => removeAmenity(idx)} className="text-stone-400 group-hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AGENCY SECTION */}
          {showAgencySection && (
              <Card className="border border-stone-100 shadow-sm bg-white overflow-hidden">
                <div className="h-1 bg-[#da654d] w-full" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><span className="text-2xl">🤝</span> Agent / Seller</CardTitle>
                  <CardDescription>Detected from the listing source</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-6 p-4 bg-stone-50 rounded-xl border">
                    {formData.agency.logo_url ? (<div className="h-16 w-16 bg-white rounded-lg shadow-sm p-2 flex items-center justify-center flex-shrink-0"><img src={formData.agency.logo_url} alt="Agency Logo" className="max-w-full max-h-full object-contain" /></div>) : (<div className="h-16 w-16 bg-gray-200 rounded-lg flex items-center justify-center text-stone-400 flex-shrink-0"><span className="text-2xl">🏢</span></div>)}
                    <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                            <Label>Agency Name</Label>
                            <Input value={formData.agency.name} onChange={(e) => setFormData(prev => ({ ...prev, agency: { ...prev.agency, name: e.target.value } }))} className="font-medium text-lg" />
                      </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-normal text-stone-500">WhatsApp</Label>
                                <Input value={formData.agency.whatsapp} onChange={(e) => setFormData(prev => ({ ...prev, agency: { ...prev.agency, whatsapp: e.target.value } }))} className="h-8 text-sm" placeholder="+34..." />
                      </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-normal text-stone-500">Phone</Label>
                                <Input value={formData.agency.phone} onChange={(e) => setFormData(prev => ({ ...prev, agency: { ...prev.agency, phone: e.target.value } }))} className="h-8 text-sm" placeholder="+34..." />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-normal text-stone-500">Email</Label>
                                <Input value={formData.agency.email} onChange={(e) => setFormData(prev => ({ ...prev, agency: { ...prev.agency, email: e.target.value } }))} className="h-8 text-sm" placeholder="@..." />
                            </div>
                        </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
          )}

          {/* PHOTOS SECTION */}
            <div id="photos" ref={photosRef}>
            <Card className="border border-stone-100 shadow-sm bg-white overflow-hidden">
              <div className="h-1 bg-[#da654d] w-full" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-[#da654d]" /> Photos & Documents</CardTitle>
                <CardDescription>Upload images and floorplans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:bg-stone-50 transition-colors cursor-pointer relative group">
                  <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="flex flex-col items-center transition-transform group-hover:scale-105">
                      <div className="bg-stone-100 p-3 rounded-full mb-3"><Upload className="h-6 w-6 text-[#da654d]" /></div>
                      <h3 className="font-semibold text-base text-gray-700">Click or drag photos here</h3>
                    <p className="text-sm text-stone-500 mt-1">Supports JPG, PNG, WEBP</p>
                  </div>
                </div>

                {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-3" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
                      {photos.map((photo, idx) => (
                        <div key={photo.previewUrl || idx} className="relative group border rounded-lg overflow-hidden shadow-sm bg-white transition-all hover:shadow-md">
                          <div className="aspect-[4/3] relative bg-gray-100">
                            <img src={photo.previewUrl} alt="Preview" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            <button onClick={() => removePhoto(idx)} className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 shadow-sm"><X className="h-3 w-3" /></button>
                          </div>
                          {!photo.isFromUrl && (
                            <div className="p-2 bg-white border-t relative">
                              {editingPhotoLabel === idx ? (
                                <div className="relative">
                                  <Input value={photoLabelInput} onChange={(e) => { setPhotoLabelInput(e.target.value); setActiveLabelIndex(-1); }} onKeyDown={(e) => handlePhotoLabelKeyDown(e, idx)} onBlur={() => { if (photoLabelInput.trim()) { updatePhotoLabel(idx, photoLabelInput.trim()); } else { setEditingPhotoLabel(null); setPhotoLabelInput(''); } }} placeholder="Enter label..." className="w-full text-xs p-1.5" autoFocus />
                                  {photoLabelInput && photoLabelSuggestions.filter(s => s.toLowerCase().includes(photoLabelInput.toLowerCase())).length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-32 overflow-auto">
                                      {photoLabelSuggestions.filter(s => s.toLowerCase().includes(photoLabelInput.toLowerCase())).map((suggestion, i) => (
                                          <div key={i} className={`px-2 py-1 text-xs cursor-pointer ${i === activeLabelIndex ? 'bg-blue-50' : 'hover:bg-stone-100'}`} onClick={() => updatePhotoLabel(idx, suggestion)} onMouseEnter={() => setActiveLabelIndex(i)}>{suggestion}</div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button onClick={() => startEditingPhotoLabel(idx)} className="w-full text-xs p-1.5 border rounded bg-stone-50 hover:bg-stone-100 text-left text-stone-500">{photo.label || 'Click to add label...'}</button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
            </div>

            {/* Right Sidebar - Same as Review Mode */}
            <div className="w-80 flex-shrink-0 overflow-y-auto">
              <Card className="border-stone-200 shadow-sm sticky top-0">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-[#da654d]" />
                    Buyer Agent&apos;s Notes
                  </h3>
                  
                  <Textarea 
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="min-h-[120px] bg-white border-stone-200 focus:border-[#da654d] placeholder:text-stone-400 text-sm resize-none mb-4" 
                    placeholder="E.g. 'Client loves open kitchens', 'Check for humidity', 'Budget is tight'..." 
                  />

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-5 text-base rounded-xl shadow-md bg-[#da654d] hover:bg-[#c8553d] text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
              Analyse with Leo
                      </>
                    )}
            </Button>

                  <p className="text-xs text-center text-stone-400 mt-3">
                    Generates full report + renovation potential
                  </p>
                </CardContent>
              </Card>
          </div>
        </div>
        </div>
      </div>
      
      {/* Mobile sticky button */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-[#da654d] hover:bg-[#c8553d] text-white shadow-xl py-6 text-lg rounded-xl">
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
          Analyse with Leo
        </Button>
      </div>
    </div>
  );
}
