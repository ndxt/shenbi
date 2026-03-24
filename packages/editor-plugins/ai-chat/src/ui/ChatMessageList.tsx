import React from 'react';
import type { ChatMessage } from '../hooks/useChatSession';
import { User, Sparkles, FileImage, FileText, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@shenbi/i18n';
import { RunResultCard } from './RunResultCard';
import { getStoredAttachment } from '../attachments';

interface ChatMessageListProps {
    messages: ChatMessage[];
    onDismissRunResult?: ((messageId: string) => void) | undefined;
}

export function ChatMessageList({ messages, onDismissRunResult }: ChatMessageListProps) {
    const { t } = useTranslation('pluginAiChat');

    return (
        <div className="flex flex-col gap-6">
            {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2">
                    {/* Run result card (special message type) */}
                    {msg.runResult ? (
                        <RunResultCard
                            result={msg.runResult}
                            onDismiss={onDismissRunResult ? () => onDismissRunResult(msg.id) : undefined}
                        />
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                {msg.role === 'user' ? (
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-text-primary border border-border-ide">
                                        <User size={12} />
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center w-5 h-5 text-primary">
                                        <Sparkles size={14} />
                                    </div>
                                )}
                                <span className="font-semibold text-text-primary" style={{ fontSize: '12px' }}>
                                    {msg.role === 'user' ? t('message.you') : t('message.assistant')}
                                </span>
                            </div>
                            {msg.content && (
                                <div className={`leading-relaxed text-text-primary whitespace-pre-wrap pl-7 ${msg.role === 'user' ? 'opacity-90' : ''}`} style={{ fontSize: '12px' }}>
                                    {msg.content}
                                </div>
                            )}
                            {msg.attachments && msg.attachments.length > 0 && (
                                <MessageAttachmentList attachments={msg.attachments} />
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

function MessageAttachmentList({ attachments }: { attachments: NonNullable<ChatMessage['attachments']> }) {
    return (
        <div className="pl-7 flex flex-wrap gap-3">
            {attachments.map((attachment) => (
                <AttachmentCard key={attachment.attachmentId} attachment={attachment} />
            ))}
        </div>
    );
}

function AttachmentCard({ attachment }: { attachment: NonNullable<ChatMessage['attachments']>[number] }) {
    const { t } = useTranslation('pluginAiChat');
    const [downloadUrl, setDownloadUrl] = React.useState<string | undefined>();
    const [available, setAvailable] = React.useState(true);

    React.useEffect(() => {
        let active = true;
        let objectUrl: string | undefined;

        void getStoredAttachment(attachment.attachmentId)
            .then((storedAttachment) => {
                if (!active || !storedAttachment) {
                    if (active) {
                        setAvailable(false);
                    }
                    return;
                }
                objectUrl = URL.createObjectURL(storedAttachment.blob);
                setDownloadUrl(objectUrl);
                setAvailable(true);
            })
            .catch(() => {
                if (active) {
                    setAvailable(false);
                }
            });

        return () => {
            active = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [attachment.attachmentId]);

    if (!available) {
        return (
            <div className="rounded border border-border-ide bg-bg-canvas px-3 py-2 text-text-secondary flex items-center gap-2" style={{ fontSize: '11px' }}>
                <TriangleAlert size={12} className="text-amber-400" />
                <span>{t('message.attachmentUnavailable', { name: attachment.name })}</span>
            </div>
        );
    }

    if (attachment.previewable && downloadUrl) {
        return (
            <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="w-[148px] rounded border border-border-ide bg-bg-canvas p-2 flex flex-col gap-2 hover:border-primary transition-colors"
            >
                <img src={downloadUrl} alt={attachment.name} className="h-24 w-full rounded object-cover bg-black/10" />
                <div className="flex items-center gap-1.5 text-text-primary" style={{ fontSize: '11px' }}>
                    <FileImage size={12} />
                    <span className="truncate" title={attachment.name}>{attachment.name}</span>
                </div>
            </a>
        );
    }

    if (!downloadUrl) {
        return (
            <div
                className="rounded border border-border-ide bg-bg-canvas px-3 py-2 flex items-center gap-2 text-text-secondary"
                style={{ fontSize: '11px' }}
            >
                <FileText size={12} />
                <span className="truncate max-w-[220px]" title={attachment.name}>{attachment.name}</span>
            </div>
        );
    }

    return (
        <a
            href={downloadUrl}
            download={attachment.name}
            className="rounded border border-border-ide bg-bg-canvas px-3 py-2 flex items-center gap-2 text-text-primary hover:border-primary transition-colors"
            style={{ fontSize: '11px' }}
        >
            <FileText size={12} />
            <span className="truncate max-w-[220px]" title={attachment.name}>{attachment.name}</span>
        </a>
    );
}
