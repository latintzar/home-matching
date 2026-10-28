# Progressive Component Pattern

This document explains the **Progressive Component Pattern** implemented across the Puedo Casa codebase. This pattern ensures components gracefully handle partial data and provide clear feedback about pipeline stages.

## 🎯 **Core Concept**

Instead of showing broken states or generic loading spinners, components **progressively enhance** based on available data, showing users exactly what's been processed and what's coming next.

## 🏗️ **Architecture**

### **Foundation Components**
- `ProgressiveComponent` - Core wrapper that handles stage detection and skeleton rendering
- `PipelineIndicator` - Shows current pipeline stage with visual indicators
- `ConditionalRender` - Renders content based on pipeline stage requirements

### **Utilities**
- `pipeline-utils.ts` - Stage detection, progress calculation, stage information
- `progressive-components.ts` - TypeScript interfaces and data contracts
- `usePipelineData.ts` - React hook for managing pipeline-aware data

### **Templates**
- `ProgressiveComponentTemplate.tsx` - Template for converting existing components

## 📊 **Pipeline Stages**

| Stage | Description | Data Available | Visual Indicator |
|-------|-------------|----------------|------------------|
| `none` | No data | None | ⏳ Gray |
| `scraped` | Basic info | Title, price, area | ✅ Blue |
| `photos-stored` | Photos ready | + Photos | 📸 Green |
| `text-analysis` | AI analysis | + Headlines, unknowns | 📝 Purple |
| `complete` | Full data | + Follow-ups | 🎉 Emerald |

## 🚀 **Usage Examples**

### **Basic Progressive Component**
```typescript
import ProgressiveComponent from '@/components/foundation/ProgressiveComponent';

const MyComponent = ({ data }) => (
  <ProgressiveComponent data={data}>
    <div>My content here</div>
  </ProgressiveComponent>
);
```

### **Stage-Specific Rendering**
```typescript
import { ConditionalRender } from '@/components/foundation/ProgressiveComponent';

<ConditionalRender 
  stage={pipelineStage} 
  requiredStages={['text-analysis', 'complete']}
>
  <div>Only shows when text analysis is complete</div>
</ConditionalRender>
```

### **Using the Hook**
```typescript
import { usePipelineData } from '@/hooks/usePipelineData';

const MyComponent = ({ data }) => {
  const { pipelineStage, isSkeleton, hasStageData } = usePipelineData(data);
  
  return (
    <div>
      <PipelineIndicator stage={pipelineStage} />
      {hasStageData('photos-stored') && <PhotoGallery />}
    </div>
  );
};
```

## 🔄 **Migration Guide**

### **Step 1: Update Imports**
```typescript
// Before
import { useState } from 'react';

// After
import ProgressiveComponent, { ConditionalRender } from '@/components/foundation/ProgressiveComponent';
import { usePipelineData } from '@/hooks/usePipelineData';
```

### **Step 2: Update Component Interface**
```typescript
// Before
interface MyComponentProps {
  data: any;
  onAction: () => void;
}

// After
interface MyComponentProps extends ProgressiveComponentProps {
  onAction: () => void;
}
```

### **Step 3: Replace State Management**
```typescript
// Before
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

// After
const { data, pipelineStage, setData } = usePipelineData(initialData);
```

### **Step 4: Update Rendering Logic**
```typescript
// Before
if (!data) return <Skeleton />;
if (loading) return <Spinner />;

// After
<ProgressiveComponent data={data}>
  <ConditionalRender stage={pipelineStage} requiredStages={['scraped']}>
    <BasicInfo />
  </ConditionalRender>
</ProgressiveComponent>
```

## 🎨 **Visual Design**

### **Stage Indicators**
- **Color-coded badges** with icons and descriptions
- **Progress bars** showing completion percentage
- **Contextual messages** explaining what's available

### **Skeleton States**
- **Data-driven skeletons** that match real content layout
- **Stage-specific placeholders** showing what's coming
- **Smooth transitions** when real data loads

### **Error Handling**
- **Graceful degradation** for missing data
- **Clear messaging** about what's not available
- **Recovery suggestions** for failed stages

## 📈 **Benefits**

### **User Experience**
- **No broken states** - components always show something meaningful
- **Clear expectations** - users know what's been processed
- **Progressive disclosure** - information appears as it becomes available

### **Developer Experience**
- **Consistent patterns** - all components work the same way
- **Easy testing** - can test each pipeline stage independently
- **Maintainable** - changes to data contracts automatically update UI

### **Business Value**
- **Professional appearance** - no loading spinners or broken states
- **User confidence** - clear progress indication
- **Debugging** - pipeline issues are immediately visible

## 🔧 **Advanced Features**

### **Custom Stage Detection**
```typescript
const customDetectStage = (data: any): PipelineStage => {
  // Custom logic for detecting stages
  if (data.customField) return 'complete';
  return detectPipelineStage(data);
};
```

### **Stage Transitions**
```typescript
const { pipelineStage, setData } = usePipelineData(data, {
  onStageChange: (newStage) => {
    console.log(`Pipeline advanced to: ${newStage}`);
    // Trigger side effects
  }
});
```

### **Custom Skeletons**
```typescript
<ProgressiveComponent 
  data={data}
  skeletonComponent={<CustomSkeleton />}
>
  <Content />
</ProgressiveComponent>
```

## 🧪 **Testing**

### **Test Each Stage**
```typescript
// Test skeleton mode
render(<MyComponent data={null} />);

// Test partial data
render(<MyComponent data={{ title: 'Test' }} />);

// Test complete data
render(<MyComponent data={fullData} />);
```

### **Test Stage Transitions**
```typescript
const { result } = renderHook(() => usePipelineData(null));
act(() => {
  result.current.setData({ title: 'Test' });
});
expect(result.current.pipelineStage).toBe('scraped');
```

## 📚 **Best Practices**

1. **Always use the foundation components** - don't reinvent skeleton logic
2. **Test all pipeline stages** - ensure graceful handling of partial data
3. **Use ConditionalRender** - don't manually check pipeline stages
4. **Follow data contracts** - use PropertyDataContract interfaces
5. **Document stage requirements** - make it clear what data each stage needs

## 🚀 **Future Enhancements**

- **Animation transitions** between stages
- **Real-time updates** when pipeline progresses
- **Custom stage definitions** for different component types
- **Performance optimizations** for large datasets
- **Accessibility improvements** for screen readers

---

This pattern transforms your components from fragile, data-dependent elements into robust, user-friendly interfaces that gracefully handle any data state. It's the foundation for a professional, scalable UI architecture.
