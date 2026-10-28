
import React from "react";
import { 
  Layout1Classic, 
  Layout2Editorial, 
  Layout3Dashboard, 
  Layout4Visual, 
  Layout5Timeline,
  Layout6Split,
  Layout7MobileStack,
  Layout8Blueprint,
  Layout9Notion,
  Layout10Cyberpunk,
  Layout11ForensicDossier,
  Layout12Optimism
} from "./variations/index";

interface VariationsRendererProps {
  index: number;
  data: any;
}

export const VariationsRenderer: React.FC<VariationsRendererProps> = ({ index, data }) => {
  switch (index) {
    case 0: return <Layout1Classic data={data} />;
    case 1: return <Layout2Editorial data={data} />;
    case 2: return <Layout3Dashboard data={data} />;
    case 3: return <Layout4Visual data={data} />;
    case 4: return <Layout5Timeline data={data} />;
    case 5: return <Layout6Split data={data} />;
    case 6: return <Layout7MobileStack data={data} />;
    case 7: return <Layout8Blueprint data={data} />;
    case 8: return <Layout9Notion data={data} />;
    case 9: return <Layout10Cyberpunk data={data} />;
    case 10: return <Layout11ForensicDossier data={data} />;
    case 11: return <Layout12Optimism data={data} />;
    default: return <div className="p-10 text-center">Layout not implemented yet</div>;
  }
};

