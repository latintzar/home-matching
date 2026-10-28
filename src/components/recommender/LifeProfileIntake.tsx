'use client';

/**
 * Life Profile Intake Component
 * 
 * A multi-step wizard for capturing user lifestyle preferences.
 * Part of R1: Life Profile Intake for the Recommender System.
 */

import React, { useState, useCallback } from 'react';
import {
  LifeProfile,
  Household,
  LifestyleDNA,
  Constraints,
  Tradeoffs,
  PropertyPreferences,
  DEFAULT_LIFE_PROFILE,
  DEFAULT_HOUSEHOLD,
  DEFAULT_LIFESTYLE,
  DEFAULT_CONSTRAINTS,
  DEFAULT_TRADEOFFS,
  DEFAULT_PROPERTY_PREFERENCES,
  WorkSituation,
  RenovationAppetite,
} from '@/types/recommender';

// ============================================================================
// Types
// ============================================================================

interface IntakeProps {
  initialProfile?: Partial<LifeProfile>;
  onComplete: (profile: LifeProfile) => void;
  onSave?: (profile: Partial<LifeProfile>) => void;
}

type Step = 'household' | 'lifestyle' | 'constraints' | 'tradeoffs' | 'property' | 'review';

const STEPS: Step[] = ['household', 'lifestyle', 'constraints', 'tradeoffs', 'property', 'review'];

const STEP_TITLES: Record<Step, string> = {
  household: '👥 Tu Hogar',
  lifestyle: '🌟 Tu Estilo de Vida',
  constraints: '📊 Tus Límites',
  tradeoffs: '⚖️ Tus Prioridades',
  property: '🏠 Tu Vivienda Ideal',
  review: '✅ Resumen',
};

// ============================================================================
// Subcomponents
// ============================================================================

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ 
  currentStep, 
  totalSteps 
}) => (
  <div className="flex items-center gap-1 sm:gap-2 mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <div key={i} className="flex items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
            i < currentStep
              ? 'bg-emerald-500 text-white'
              : i === currentStep
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-200'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {i < currentStep ? '✓' : i + 1}
        </div>
        {i < totalSteps - 1 && (
          <div
            className={`w-2 sm:w-8 h-0.5 ${
              i < currentStep ? 'bg-emerald-500' : 'bg-gray-200'
            }`}
          />
        )}
      </div>
    ))}
  </div>
);

const SliderInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
  description?: string;
}> = ({ value, onChange, leftLabel, rightLabel, description }) => (
  <div className="space-y-2">
    {description && <p className="text-sm text-gray-600">{description}</p>}
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-500 w-24 text-right">{leftLabel}</span>
      <input
        type="range"
        min="-5"
        max="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
      />
      <span className="text-sm text-gray-500 w-24">{rightLabel}</span>
    </div>
    <div className="text-center text-xs text-gray-400">
      {value === 0 ? 'Equilibrado' : value < 0 ? `${leftLabel} (+${Math.abs(value)})` : `${rightLabel} (+${value})`}
    </div>
  </div>
);

const TagInput: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}> = ({ tags, onChange, placeholder, suggestions = [] }) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim() && !tags.includes(input.trim())) {
      onChange([...tags, input.trim()]);
      setInput('');
    }
  };

  const handleRemove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm"
          >
            {tag}
            <button
              onClick={() => handleRemove(tag)}
              className="hover:text-emerald-900"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          +
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.filter((s) => !tags.includes(s)).slice(0, 5).map((s) => (
            <button
              key={s}
              onClick={() => onChange([...tags, s])}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Step Components
// ============================================================================

const HouseholdStep: React.FC<{
  data: Household;
  onChange: (data: Household) => void;
}> = ({ data, onChange }) => {
  const updateField = <K extends keyof Household>(key: K, value: Household[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">Cuéntanos sobre tu hogar</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Cuántos adultos vivirán en la casa?
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => updateField('adults', n)}
              className={`w-12 h-12 rounded-lg font-medium transition-colors ${
                data.adults === n
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {n}{n === 4 ? '+' : ''}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Tienes hijos? (indica sus edades)
        </label>
        <div className="flex gap-2 flex-wrap">
          {data.children.map((child, i) => (
            <div key={i} className="flex items-center gap-1 bg-emerald-100 px-3 py-1 rounded-full">
              <span className="text-sm">{child.age} años</span>
              <button
                onClick={() => updateField('children', data.children.filter((_, j) => j !== i))}
                className="text-emerald-700 hover:text-emerald-900"
              >
                ×
              </button>
            </div>
          ))}
          <select
            onChange={(e) => {
              if (e.target.value) {
                updateField('children', [...data.children, { age: parseInt(e.target.value) }]);
                e.target.value = '';
              }
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
            defaultValue=""
          >
            <option value="">+ Añadir hijo</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((age) => (
              <option key={age} value={age}>{age} años</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Tienes mascotas?
        </label>
        <div className="flex gap-2 flex-wrap">
          {data.pets.map((pet, i) => (
            <div key={i} className="flex items-center gap-1 bg-emerald-100 px-3 py-1 rounded-full">
              <span className="text-sm">{pet.type} ({pet.size})</span>
              <button
                onClick={() => updateField('pets', data.pets.filter((_, j) => j !== i))}
                className="text-emerald-700 hover:text-emerald-900"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-1">
            <select
              id="pet-type"
              className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
              defaultValue=""
            >
              <option value="">Tipo</option>
              <option value="dog">🐕 Perro</option>
              <option value="cat">🐱 Gato</option>
              <option value="bird">🐦 Pájaro</option>
              <option value="other">🐹 Otro</option>
            </select>
            <select
              id="pet-size"
              className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
              defaultValue=""
            >
              <option value="">Tamaño</option>
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
            <button
              onClick={() => {
                const typeEl = document.getElementById('pet-type') as HTMLSelectElement;
                const sizeEl = document.getElementById('pet-size') as HTMLSelectElement;
                if (typeEl.value && sizeEl.value) {
                  updateField('pets', [...data.pets, { 
                    type: typeEl.value as any, 
                    size: sizeEl.value as any 
                  }]);
                  typeEl.value = '';
                  sizeEl.value = '';
                }
              }}
              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Cómo es tu situación laboral?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'remote', label: '🏠 100% Remoto' },
            { value: 'hybrid', label: '🔄 Híbrido' },
            { value: 'office', label: '🏢 Oficina' },
            { value: 'retired', label: '🌴 Jubilado' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateField('workSituation', option.value as WorkSituation)}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                data.workSituation === option.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const LifestyleStep: React.FC<{
  data: LifestyleDNA;
  onChange: (data: LifestyleDNA) => void;
}> = ({ data, onChange }) => {
  const updateField = <K extends keyof LifestyleDNA>(key: K, value: LifestyleDNA[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">Tu estilo de vida</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Cómo es tu mañana ideal? 🌅
        </label>
        <textarea
          value={data.morningRoutine}
          onChange={(e) => updateField('morningRoutine', e.target.value)}
          placeholder="Ej: Café en la terraza mientras leo el periódico, yoga a las 7am, desayuno con la familia..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Y tus tardes/noches? 🌙
        </label>
        <textarea
          value={data.eveningRoutine}
          onChange={(e) => updateField('eveningRoutine', e.target.value)}
          placeholder="Ej: Cocinar recetas elaboradas, ver Netflix en el sofá, pasear al perro..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Qué haces los fines de semana? 🎉
        </label>
        <TagInput
          tags={data.weekendActivities}
          onChange={(tags) => updateField('weekendActivities', tags)}
          placeholder="Añade una actividad..."
          suggestions={['Senderismo', 'Brunch', 'Cine', 'Deportes', 'Familia', 'Amigos en casa', 'Lectura', 'Jardín']}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lo que NO soportarías ❌
        </label>
        <TagInput
          tags={data.dealbreakers}
          onChange={(tags) => updateField('dealbreakers', tags)}
          placeholder="Añade un dealbreaker..."
          suggestions={['Ruido de calle', 'Sin luz natural', 'Muchas escaleras', 'Lejos del metro', 'Sin parking', 'Vecinos ruidosos']}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lo imprescindible ✅
        </label>
        <TagInput
          tags={data.mustHaves}
          onChange={(tags) => updateField('mustHaves', tags)}
          placeholder="Añade un must-have..."
          suggestions={['Terraza', 'Luz natural', 'Silencioso', 'Cerca del centro', 'Parking', 'Trastero', 'Piscina']}
        />
      </div>
    </div>
  );
};

const ConstraintsStep: React.FC<{
  data: Constraints;
  onChange: (data: Constraints) => void;
}> = ({ data, onChange }) => {
  const updateField = <K extends keyof Constraints>(key: K, value: Constraints[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">Tus límites y necesidades</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Presupuesto máximo 💰
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="100000"
            max="2000000"
            step="25000"
            value={data.maxBudget}
            onChange={(e) => updateField('maxBudget', parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <span className="text-lg font-semibold text-emerald-600 w-28 text-right">
            {(data.maxBudget / 1000).toFixed(0)}k €
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>100k €</span>
          <span>2M €</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tiempo máximo de commute ⏱️
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="10"
            max="60"
            step="5"
            value={data.maxCommuteMinutes}
            onChange={(e) => updateField('maxCommuteMinutes', parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <span className="text-lg font-semibold text-emerald-600 w-20 text-right">
            {data.maxCommuteMinutes} min
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿A dónde tienes que ir? (trabajo, colegio, etc.) 📍
        </label>
        <input
          type="text"
          value={data.commuteDestination}
          onChange={(e) => updateField('commuteDestination', e.target.value)}
          placeholder="Ej: Calle Serrano 45, Madrid"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ¿Cuánta reforma aguantas? 🔨
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'turnkey', label: '✨ Llave en mano', desc: 'No quiero obras' },
            { value: 'cosmetic', label: '🎨 Cosmética', desc: 'Pintura, suelos' },
            { value: 'full', label: '🏗️ Integral', desc: 'Sin problema' },
            { value: 'any', label: '🤷 Me da igual', desc: 'Lo que sea' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => updateField('renovationAppetite', option.value as RenovationAppetite)}
              className={`px-4 py-3 rounded-lg text-left transition-colors ${
                data.renovationAppetite === option.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className={`text-xs ${
                data.renovationAppetite === option.value ? 'text-emerald-100' : 'text-gray-500'
              }`}>
                {option.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TradeoffsStep: React.FC<{
  data: Tradeoffs;
  onChange: (data: Tradeoffs) => void;
}> = ({ data, onChange }) => {
  const updateField = <K extends keyof Tradeoffs>(key: K, value: Tradeoffs[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">¿Qué prefieres?</h3>
        <p className="text-sm text-gray-500 mt-1">
          Desliza hacia lo que más valoras. Esto nos ayuda a ordenar tus resultados.
        </p>
      </div>
      
      <SliderInput
        value={data.spaceVsLocation}
        onChange={(v) => updateField('spaceVsLocation', v)}
        leftLabel="Más espacio"
        rightLabel="Mejor ubicación"
        description="¿Preferirías más metros en las afueras o menos metros en el centro?"
      />

      <SliderInput
        value={data.newVsCharacter}
        onChange={(v) => updateField('newVsCharacter', v)}
        leftLabel="Construcción nueva"
        rightLabel="Con carácter"
        description="¿Prefieres algo moderno y eficiente o con personalidad y historia?"
      />

      <SliderInput
        value={data.quietVsVibrant}
        onChange={(v) => updateField('quietVsVibrant', v)}
        leftLabel="Tranquilidad"
        rightLabel="Vida de barrio"
        description="¿Calle silenciosa o cerca de bares y tiendas?"
      />

      <SliderInput
        value={data.viewsVsPrivacy}
        onChange={(v) => updateField('viewsVsPrivacy', v)}
        leftLabel="Buenas vistas"
        rightLabel="Máxima privacidad"
        description="¿Quieres ver el cielo aunque te vean a ti?"
      />
    </div>
  );
};

const PropertyStep: React.FC<{
  data: PropertyPreferences;
  onChange: (data: PropertyPreferences) => void;
}> = ({ data, onChange }) => {
  const updateField = <K extends keyof PropertyPreferences>(key: K, value: PropertyPreferences[K]) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">Tu vivienda ideal</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de propiedad 🏠
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'piso', label: '🏢 Piso' },
            { value: 'casa', label: '🏡 Casa' },
            { value: 'chalet', label: '🏘️ Chalet' },
            { value: 'atico', label: '🌇 Ático' },
            { value: 'duplex', label: '↕️ Dúplex' },
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => {
                const newTypes = data.propertyTypes.includes(type.value)
                  ? data.propertyTypes.filter((t) => t !== type.value)
                  : [...data.propertyTypes, type.value];
                updateField('propertyTypes', newTypes);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                data.propertyTypes.includes(type.value)
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Habitaciones mín. 🛏️
          </label>
          <select
            value={data.minBedrooms}
            onChange={(e) => updateField('minBedrooms', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}+</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Baños mín. 🚿
          </label>
          <select
            value={data.minBathrooms}
            onChange={(e) => updateField('minBathrooms', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}+</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            m² mín. 📐
          </label>
          <select
            value={data.minSqm}
            onChange={(e) => updateField('minSqm', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {[40, 60, 80, 100, 120, 150, 200].map((n) => (
              <option key={n} value={n}>{n}+ m²</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Zonas preferidas 📍
        </label>
        <TagInput
          tags={data.preferredLocations}
          onChange={(tags) => updateField('preferredLocations', tags)}
          placeholder="Añade una zona..."
          suggestions={['Salamanca', 'Chamberí', 'Centro', 'Retiro', 'Chamartín', 'Hortaleza']}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Zonas a evitar 🚫
        </label>
        <TagInput
          tags={data.avoidLocations}
          onChange={(tags) => updateField('avoidLocations', tags)}
          placeholder="Añade una zona..."
        />
      </div>
    </div>
  );
};

const ReviewStep: React.FC<{
  profile: Partial<LifeProfile>;
}> = ({ profile }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-gray-800">Resumen de tu perfil</h3>
    
    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
      <div>
        <h4 className="font-medium text-gray-700">👥 Hogar</h4>
        <p className="text-sm text-gray-600">
          {profile.household?.adults} adulto(s)
          {profile.household?.children?.length ? `, ${profile.household.children.length} hijo(s)` : ''}
          {profile.household?.pets?.length ? `, ${profile.household.pets.length} mascota(s)` : ''}
          {profile.household?.workSituation && ` • ${profile.household.workSituation}`}
        </p>
      </div>

      <div>
        <h4 className="font-medium text-gray-700">💰 Presupuesto</h4>
        <p className="text-sm text-gray-600">
          Hasta {((profile.constraints?.maxBudget || 0) / 1000).toFixed(0)}k €
          {profile.constraints?.commuteDestination && ` • Commute: ${profile.constraints.maxCommuteMinutes} min a ${profile.constraints.commuteDestination}`}
        </p>
      </div>

      <div>
        <h4 className="font-medium text-gray-700">🏠 Vivienda</h4>
        <p className="text-sm text-gray-600">
          {profile.propertyPreferences?.propertyTypes?.join(', ')} •
          {profile.propertyPreferences?.minBedrooms}+ hab •
          {profile.propertyPreferences?.minSqm}+ m²
        </p>
      </div>

      {(profile.lifestyle?.mustHaves?.length || profile.lifestyle?.dealbreakers?.length) && (
        <div>
          <h4 className="font-medium text-gray-700">⭐ Prioridades</h4>
          {profile.lifestyle?.mustHaves?.length ? (
            <p className="text-sm text-emerald-600">
              ✅ {profile.lifestyle.mustHaves.join(', ')}
            </p>
          ) : null}
          {profile.lifestyle?.dealbreakers?.length ? (
            <p className="text-sm text-red-600">
              ❌ {profile.lifestyle.dealbreakers.join(', ')}
            </p>
          ) : null}
        </div>
      )}
    </div>

    <p className="text-sm text-gray-500 text-center">
      ¡Listo! Ahora buscaremos viviendas que encajen con tu estilo de vida.
    </p>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const LifeProfileIntake: React.FC<IntakeProps> = ({
  initialProfile,
  onComplete,
  onSave,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<Partial<LifeProfile>>({
    household: { ...DEFAULT_HOUSEHOLD, ...initialProfile?.household },
    lifestyle: { ...DEFAULT_LIFESTYLE, ...initialProfile?.lifestyle },
    constraints: { ...DEFAULT_CONSTRAINTS, ...initialProfile?.constraints },
    tradeoffs: { ...DEFAULT_TRADEOFFS, ...initialProfile?.tradeoffs },
    propertyPreferences: { ...DEFAULT_PROPERTY_PREFERENCES, ...initialProfile?.propertyPreferences },
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = useCallback(async () => {
    // Auto-save on step change
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave({ ...profile, intakeStep: currentStep + 1 });
      } catch (e) {
        console.error('Failed to save:', e);
      }
      setIsSaving(false);
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete
      const finalProfile: LifeProfile = {
        ...DEFAULT_LIFE_PROFILE,
        ...profile,
        intakeCompleted: true,
        intakeStep: STEPS.length,
      } as LifeProfile;
      onComplete(finalProfile);
    }
  }, [currentStep, profile, onSave, onComplete]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const step = STEPS[currentStep];

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{STEP_TITLES[step]}</h2>
      </div>

      <StepIndicator currentStep={currentStep} totalSteps={STEPS.length} />

      <div className="min-h-[400px]">
        {step === 'household' && (
          <HouseholdStep
            data={profile.household!}
            onChange={(household) => setProfile({ ...profile, household })}
          />
        )}
        {step === 'lifestyle' && (
          <LifestyleStep
            data={profile.lifestyle!}
            onChange={(lifestyle) => setProfile({ ...profile, lifestyle })}
          />
        )}
        {step === 'constraints' && (
          <ConstraintsStep
            data={profile.constraints!}
            onChange={(constraints) => setProfile({ ...profile, constraints })}
          />
        )}
        {step === 'tradeoffs' && (
          <TradeoffsStep
            data={profile.tradeoffs!}
            onChange={(tradeoffs) => setProfile({ ...profile, tradeoffs })}
          />
        )}
        {step === 'property' && (
          <PropertyStep
            data={profile.propertyPreferences!}
            onChange={(propertyPreferences) => setProfile({ ...profile, propertyPreferences })}
          />
        )}
        {step === 'review' && <ReviewStep profile={profile} />}
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            currentStep === 0
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          ← Atrás
        </button>

        <button
          onClick={handleNext}
          disabled={isSaving}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </span>
          ) : currentStep === STEPS.length - 1 ? (
            '🚀 Buscar viviendas'
          ) : (
            'Siguiente →'
          )}
        </button>
      </div>
    </div>
  );
};

export default LifeProfileIntake;

