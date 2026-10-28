import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { TierPreviewCard } from "@/components/TierPreviewCard";
import { Check, Copy, Edit2, X, ArrowRight, MessageCircle, ExternalLink } from "lucide-react";
import { ChatMessage } from '@/types/chat';
import { removeTierLinks } from '@/lib/chat-utils';

interface ChatMessageProps {
  message: ChatMessage;
  loading: boolean;
  isLastMessage: boolean;
  onCopy: (id: string, content: string) => void;
  onEdit?: (id: string, content: string) => void;
  onSaveEdit?: (id: string, content: string) => void;
  onOpenAnalysisModal?: (sectionId?: string) => void;
  tierInfo?: any;
  afterPhotos?: any;
  agentWhatsapp?: string | null;
}

export const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message: m,
  loading,
  isLastMessage,
  onCopy,
  onEdit,
  onSaveEdit,
  onOpenAnalysisModal,
  tierInfo,
  afterPhotos,
  agentWhatsapp
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(m.content);

  const handleCopyClick = () => {
    onCopy(m.id, m.content);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditValue(m.content);
    if (onEdit) onEdit(m.id, m.content);
  };

  const handleSaveClick = () => {
    if (onSaveEdit) onSaveEdit(m.id, editValue);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setEditValue(m.content);
  };

  return (
    <div 
      className={`flex flex-col gap-1 group ${m.role === 'user' ? 'items-end' : 'items-start'}`}
      data-message-id={m.id}
      data-message-role={m.role}
    >
      {m.role === 'user' ? (
        <>
          {isEditing ? (
            <div className="flex flex-col gap-2 w-full max-w-[85%]">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveClick();
                  }
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={handleCancelClick}>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveClick}>
                  <Check className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted rounded-lg px-4 py-2 max-w-[85%]">
              <p className="text-foreground whitespace-pre-wrap">{m.content}</p>
            </div>
          )}
          <div className="flex gap-1 mt-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
              onClick={handleCopyClick}
            >
              {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
            {!isEditing && onSaveEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
                onClick={handleEditClick}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="text-foreground max-w-[85%] prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-p:text-sm prose-p:leading-6 prose-p:mb-0 prose-p:last:mb-0 prose-ul:text-sm prose-ul:pl-0 prose-ul:ml-0 prose-ul:!pl-0 prose-ul:!ml-0 prose-li:text-sm prose-li:pl-0 prose-li:ml-0 prose-li:!pl-0 prose-li:!ml-0 prose-a:text-primary prose-a:underline prose-strong:font-semibold prose-code:text-sm prose-pre:bg-muted prose-pre:rounded">
            {/* Thinking UI */}
            {(() => {
              const isDotsMode = loading && isLastMessage && (!m.thinking || typeof m.thinking !== 'string' || !m.thinking.trim());
              const hasThinking = m.thinking && typeof m.thinking === 'string' && m.thinking.trim();
              
              return (
                <>
                  {isDotsMode && (
                    <div className="text-muted-foreground mb-3 flex items-center gap-2">
                      <span className="thinking-dots">
                        <span>.</span><span>.</span><span>.</span>
                      </span>
                    </div>
                  )}
                  
                  {hasThinking && !isDotsMode && (
                    <div className="mb-3">
                      <details className="group thinking-details" open={false}>
                        <summary className="text-sm italic font-normal text-foreground cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5 list-none [&::-webkit-details-marker]:hidden">
                          <span className={loading && isLastMessage ? '' : 'text-muted-foreground'}>
                            {(() => {
                              if (loading && isLastMessage) return 'Thinking...';
                              if (m.thinkingDurationSeconds) return `Thought for ${m.thinkingDurationSeconds} seconds`;
                              return 'Thought';
                            })()}
                          </span>
                          <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="thinking-full-view mt-2 pl-4 border-l-2 border-muted-foreground/30 italic text-sm text-foreground/80">
                          {(() => {
                            if (!m.thinking) return null;
                            const chunks = m.thinking.split(/\n\n+/).map(c => c.trim()).filter(c => c.length > 0);
                            if (chunks.length === 0) return null;
                            const formattedThinking = chunks.join('\n\n');
                            return (
                              <div className="prose prose-sm dark:prose-invert max-w-none prose-strong:font-bold prose-strong:not-italic prose-strong:text-foreground prose-p:my-2 prose-p:first:mt-0 prose-p:italic prose-p:text-sm space-y-3">
                                <ReactMarkdown>{formattedThinking}</ReactMarkdown>
                                {loading && isLastMessage && (
                                  <span className="inline-block w-0.5 h-4 ml-1 bg-foreground/60" style={{ animation: 'blink-cursor 1s step-end infinite', verticalAlign: 'baseline' }} />
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </details>
                      
                      {loading && isLastMessage && (!m.content || !m.content.trim()) && (
                        <div className="thinking-headers-view mt-2">
                          {(() => {
                            if (!m.thinking) return null;
                            const chunks = m.thinking.split(/\n\n+/).map(c => c.trim()).filter(c => c.length > 0);
                            if (chunks.length === 0) return null;
                            
                            let latestHeader: string | null = null;
                            for (let i = chunks.length - 1; i >= 0; i--) {
                              const chunk = chunks[i];
                              const headerMatch = chunk.match(/^\*\*([^*]+)\*\*/);
                              if (headerMatch) {
                                latestHeader = headerMatch[1];
                                break;
                              }
                            }
                            
                            if (!latestHeader) {
                              const firstLine = chunks[chunks.length - 1].split('\n')[0];
                              latestHeader = firstLine.replace(/\*\*/g, '').trim();
                            }
                            
                            if (!latestHeader) return null;
                            return (
                              <div className="text-sm font-bold italic text-foreground thinking-header-flash">
                                {latestHeader}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {m.content ? (
              <div className="min-w-0 break-words">
                <ReactMarkdown
                  components={{
                    ul: ({ children, ...props }) => <ul {...props} className="list-none space-y-3 my-2 pl-0 ml-0 m-0 !pl-0 !ml-0 !pr-0">{children}</ul>,
                    li: ({ children, ...props }) => (
                      <li {...props} className="flex items-start gap-2 mb-2 pl-0 ml-0 !ml-0 !pl-0">
                        <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-foreground flex-shrink-0" />
                        <span className="flex-1 [&>strong]:inline [&>strong+*]:inline">{children}</span>
                      </li>
                    ),
                    a: ({ href, children, ...props }) => {
                      if (href?.startsWith('#analysis-modal') || href?.startsWith('#analysis=')) {
                        let sectionId: string | undefined;
                        const doubleHashMatch = href.match(/#analysis-modal#(.+)$/);
                        if (doubleHashMatch) sectionId = doubleHashMatch[1];
                        else {
                          const equalsMatch = href.match(/#analysis=(.+)$/);
                          if (equalsMatch) sectionId = equalsMatch[1];
                        }
                        
                        return (
                          <a
                            {...props}
                            href={href}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (onOpenAnalysisModal) onOpenAnalysisModal(sectionId);
                            }}
                            className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80 cursor-pointer font-medium"
                          >
                            {children}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        );
                      }
                      
                      if (href?.startsWith('#tier=')) {
                        const tierMatch = href.match(/tier=(.+)$/);
                        const tier = tierMatch ? tierMatch[1] : null;
                        const tierMap: any = { 'livable': 'livable', 'estandar': 'livable', 'comfortable': 'comfortable', 'optimo': 'comfortable', 'competitive': 'competitive', 'plus': 'competitive' };
                        const mappedTier = tier ? tierMap[tier.toLowerCase()] : null;
                        
                        return (
                          <a
                            {...props}
                            href={href}
                            onClick={(e) => {
                              e.preventDefault();
                              if (mappedTier) {
                                window.dispatchEvent(new CustomEvent('open-tier-modal', { detail: { tier: mappedTier } }));
                              }
                            }}
                            className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80 cursor-pointer font-medium"
                          >
                            {children}
                            {mappedTier ? <ExternalLink className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                          </a>
                        );
                      }
                      
                      return (
                        <a
                          {...props}
                          href={href}
                          target={href?.startsWith('http') ? '_blank' : undefined}
                          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="text-primary underline hover:text-primary/80"
                        >
                          {children}
                        </a>
                      );
                    },
                    blockquote: ({ children, ...props }) => (
                      <blockquote {...props} className="border-l-2 border-muted-foreground/30 pl-3 py-1 my-2 text-xs text-muted-foreground italic opacity-75 leading-relaxed [&>p:empty]:hidden">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {m.detectedTiers && m.detectedTiers.length > 0 ? removeTierLinks(m.content) : m.content}
                </ReactMarkdown>
                {loading && isLastMessage && m.content && (
                  <span className="inline-block w-0.5 h-4 ml-1 bg-foreground" style={{ animation: 'blink-cursor 1s step-end infinite', verticalAlign: 'baseline' }} />
                )}
              </div>
            ) : null}

            {/* Tier Preview Card */}
            {!loading && m.role === 'assistant' && m.cta?.type === 'tier' && m.cta.tier && tierInfo && (
              (() => {
                const tier = m.cta!.tier!;
                const tierData = tierInfo[tier];
                const afterPhotoUrl = afterPhotos?.[tier]?.[0];
                if (!tierData) return null;
                return (
                  <div className="mt-4">
                    <TierPreviewCard
                      tier={tier}
                      tierName={tierData.name}
                      priceRange={tierData.priceRange}
                      afterPhotoUrl={afterPhotoUrl}
                      onClick={() => window.dispatchEvent(new CustomEvent('open-tier-modal', { detail: { tier } }))}
                    />
                  </div>
                );
              })()
            )}
          </div>

          {/* CTA Buttons */}
          {!loading && m.role === 'assistant' && m.cta && (
            <div className="mt-0">
              {m.cta.type === 'whatsapp' && agentWhatsapp && m.cta.whatsappMessage ? (
                <Button
                  onClick={() => {
                    const cleanNum = agentWhatsapp.replace(/[\s\-\(\)]/g, '');
                    window.open(`https://wa.me/${cleanNum}?text=${encodeURIComponent(m.cta!.whatsappMessage!)}`, '_blank');
                  }}
                  className="bg-[#25d366] hover:bg-[#20bd5a] text-black border border-black hover:border-black"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Ask Agent
                </Button>
              ) : m.cta.type === 'analysis' ? (
                <Button
                  onClick={() => onOpenAnalysisModal && onOpenAnalysisModal()}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  See Full Analysis
                </Button>
              ) : null}
            </div>
          )}

          {!(loading && isLastMessage) && (
            <div className="flex gap-1 mt-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
                onClick={handleCopyClick}
              >
                {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

