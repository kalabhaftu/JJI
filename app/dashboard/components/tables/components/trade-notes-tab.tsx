import { Spinner } from '@/components/ui/spinner'

import React from 'react'
import { Control, Controller, FieldValues, Path, useController } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Pencil, Trash2, Plus, X, LayoutTemplate, Loader2 } from 'lucide-react'
import { FileDropzone } from '@/components/ui/file-dropzone'
import { TradeImagesGallery } from './trade-images-gallery'
import { parseTradePreviewImageValue } from '@/lib/trade-preview-image'
import { DEFAULT_TRADE_PREVIEW_TRANSFORM, type TradePreviewTransform } from '@/lib/trade-preview'
import { TradePreviewCropEditor } from './trade-preview-crop-editor'
import { toast } from 'sonner'
import { BUILT_IN_JOURNAL_TEMPLATES } from '@/lib/journal-note-templates'
import { reportClientError } from '@/lib/observability/report-error'

type TradeNotesFieldValues = FieldValues & {
    comment?: string
}

interface TradeNotesTabProps<TFieldValues extends TradeNotesFieldValues = TradeNotesFieldValues> {
    control: Control<TFieldValues>
    cardPreviewImage: string | null
    cardPreviewTransform: TradePreviewTransform | null
    images: Record<string, string | null>
    onUpload: (field: string, file: File) => void
    onRemove: (field: string) => void
    imageErrors: Record<string, boolean>
    setImageError: (field: string, hasError: boolean) => void
    uploadingField: string | null
    chartLinks: string[]
    setChartLinks: (links: string[]) => void
    isSubmitting?: boolean
    onPreviewTransformChange: (transform: TradePreviewTransform) => void
}

const EMPTY_PARAGRAPH_NODE = {
    children: [
        {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "",
            type: "text",
            version: 1,
        },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
}

const EMPTY_LEXICAL_STATE = {
    root: {
        children: [{ ...EMPTY_PARAGRAPH_NODE }],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
    },
}

const MAX_CUSTOM_TEMPLATES = 3

type CustomJournalTemplate = {
    id: string
    name: string
    content: any
    createdAt: string
    updatedAt: string
}

function normalizeToLexicalState(value?: string) {
    if (!value || value.trim() === "") return { ...EMPTY_LEXICAL_STATE }

    try {
        const parsed = JSON.parse(value)
        if (parsed?.root && Array.isArray(parsed.root.children)) {
            const children = parsed.root.children.length > 0
                ? parsed.root.children
                : [{ ...EMPTY_PARAGRAPH_NODE }]

            return {
                ...parsed,
                root: {
                    ...parsed.root,
                    children,
                },
            }
        }
    } catch {
        // fall through and wrap plain text
    }

    return {
        root: {
            children: [
                {
                    children: [
                        {
                            detail: 0,
                            format: 0,
                            mode: "normal",
                            style: "",
                            text: value,
                            type: "text",
                            version: 1,
                        },
                    ],
                    direction: "ltr",
                    format: "",
                    indent: 0,
                    type: "paragraph",
                    version: 1,
                },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "root",
            version: 1,
        },
    }
}

function hasMeaningfulContent(value?: string) {
    if (!value) return false
    const trimmed = value.trim()
    if (!trimmed || trimmed === '<p></p>') return false

    try {
        const parsed = normalizeToLexicalState(value)
        const children = parsed?.root?.children || []
        if (children.length === 0) return false

        const extractText = (nodes: any[]): string => {
            return nodes.map(node => {
                if (node.text) return node.text;
                if (Array.isArray(node.children)) return extractText(node.children);
                return "";
            }).join("");
        };

        return children.some((node: any) => {
            const text = extractText([node]);
            return text.trim().length > 0
        })
    } catch {
        return true
    }
}

function isEmptyParagraphNode(node: any) {
    if (!node || node.type !== "paragraph" || !Array.isArray(node.children)) return false
    if (node.children.length === 0) return true
    return node.children.every((child: any) => String(child?.text || "").trim() === "")
}

function insertTemplateIntoNote(currentValue: string | undefined, templateState: any) {
    const currentState = normalizeToLexicalState(currentValue)
    const template = templateState?.root?.children ? templateState : normalizeToLexicalState(JSON.stringify(templateState))

    if (!hasMeaningfulContent(currentValue)) {
        return JSON.stringify(template)
    }

    const currentChildren = Array.isArray(currentState.root?.children) ? [...currentState.root.children] : [{ ...EMPTY_PARAGRAPH_NODE }]
    const templateChildren = Array.isArray(template.root?.children) ? [...template.root.children] : []

    if (currentChildren.length > 0 && !isEmptyParagraphNode(currentChildren[currentChildren.length - 1])) {
        currentChildren.push({ ...EMPTY_PARAGRAPH_NODE })
    }

    return JSON.stringify({
        ...currentState,
        root: {
            ...currentState.root,
            children: [...currentChildren, ...templateChildren],
        },
    })
}

export function TradeNotesTab<TFieldValues extends TradeNotesFieldValues = TradeNotesFieldValues>({
    control,
    cardPreviewImage,
    cardPreviewTransform,
    images,
    onUpload,
    onRemove,
    imageErrors,
    setImageError,
    uploadingField,
    chartLinks,
    setChartLinks,
    isSubmitting = false,
    onPreviewTransformChange,
}: TradeNotesTabProps<TFieldValues>) {
    const { field: commentField } = useController({
        name: 'comment' as Path<TFieldValues>,
        control,
    })

    const currentCommentValue = typeof commentField.value === 'string' ? commentField.value : ''
    const noteHasContent = hasMeaningfulContent(currentCommentValue)
    const normalizedCardPreviewImage = parseTradePreviewImageValue(cardPreviewImage).src
    const [customTemplates, setCustomTemplates] = React.useState<CustomJournalTemplate[]>([])
    const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)
    const [isSavingTemplate, setIsSavingTemplate] = React.useState(false)
    const [deletingTemplateId, setDeletingTemplateId] = React.useState<string | null>(null)
    const [isTemplateNameDialogOpen, setIsTemplateNameDialogOpen] = React.useState(false)
    const [templateName, setTemplateName] = React.useState('')

    const loadCustomTemplates = React.useCallback(async () => {
        try {
            setIsLoadingTemplates(true)
            const response = await fetch('/api/v1/journal/templates', { cache: 'no-store' })
            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Failed to load custom templates')
            }

            const templates = Array.isArray(payload?.data?.templates) ? payload.data.templates : []
            setCustomTemplates(templates)
        } catch (error) {
            reportClientError(error, { operation: 'load-journal-templates', route: '/api/v1/journal/templates' })
            toast.error(error instanceof Error ? error.message : 'Failed to load custom templates')
        } finally {
            setIsLoadingTemplates(false)
        }
    }, [])

    React.useEffect(() => {
        void loadCustomTemplates()
    }, [loadCustomTemplates])

    const getUniqueTemplateName = React.useCallback((baseName: string) => {
        const existingNames = new Set(customTemplates.map((template) => template.name.trim().toLowerCase()))
        if (!existingNames.has(baseName.trim().toLowerCase())) return baseName

        let counter = 2
        while (existingNames.has(`${baseName} ${counter}`.toLowerCase())) {
            counter += 1
        }
        return `${baseName} ${counter}`
    }, [customTemplates])

    const applyTemplate = React.useCallback((templateContent: any) => {
        commentField.onChange(insertTemplateIntoNote(currentCommentValue, templateContent))
    }, [commentField, currentCommentValue])

    const openSaveTemplateDialog = React.useCallback(() => {
        if (!noteHasContent) return
        setTemplateName(getUniqueTemplateName('My Template'))
        setIsTemplateNameDialogOpen(true)
    }, [getUniqueTemplateName, noteHasContent])

    const handleSaveCurrentAsTemplate = React.useCallback(async () => {
        const trimmedName = templateName.trim()
        if (!trimmedName || !noteHasContent) return

        try {
            setIsSavingTemplate(true)
            const response = await fetch('/api/v1/journal/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    content: normalizeToLexicalState(currentCommentValue),
                }),
            })

            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Failed to save template')
            }

            toast.success(payload?.data?.updated ? 'Template updated' : 'Template saved')
            setIsTemplateNameDialogOpen(false)
            setTemplateName('')
            await loadCustomTemplates()
        } catch (error) {
            reportClientError(error, { operation: 'save-journal-template', route: '/api/v1/journal/templates' })
            toast.error(error instanceof Error ? error.message : 'Failed to save template')
        } finally {
            setIsSavingTemplate(false)
        }
    }, [currentCommentValue, loadCustomTemplates, noteHasContent, templateName])

    const handleDeleteCustomTemplate = React.useCallback(async (templateId: string) => {
        try {
            setDeletingTemplateId(templateId)
            const response = await fetch(`/api/v1/journal/templates/${templateId}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error?.message || 'Failed to delete template')
            }

            setCustomTemplates((prev) => prev.filter((template) => template.id !== templateId))
            toast.success('Template deleted')
        } catch (error) {
            reportClientError(error, { operation: 'delete-journal-template', route: '/api/v1/journal/templates' })
            toast.error(error instanceof Error ? error.message : 'Failed to delete template')
        } finally {
            setDeletingTemplateId(null)
        }
    }, [])

    const trimmedTemplateName = templateName.trim()
    const templateNameTaken = customTemplates.some(
        (template) => template.name.trim().toLowerCase() === trimmedTemplateName.toLowerCase()
    )
    const canSaveTemplate = trimmedTemplateName.length > 0 && noteHasContent && !isSavingTemplate

    return (
        <div className="relative space-y-8 px-1">
            {isSubmitting ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/55 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-sm">
                        <Spinner className="h-3.5 w-3.5" />
                        Saving trade...
                    </div>
                </div>
            ) : null}
            {/* Trade Notes */}
            <div className="space-y-3">
                <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 sm:gap-2">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">Trade Notes</h3>
                        <p className="text-xs text-muted-foreground">Document your thoughts, market conditions, and key takeaways.</p>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs font-semibold bg-muted/20 shrink-0"
                                >
                                    <LayoutTemplate className="h-3.5 w-3.5 mr-2" />
                                    Templates
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80">
                                <DropdownMenuLabel>Built-in</DropdownMenuLabel>
                                {BUILT_IN_JOURNAL_TEMPLATES.map((template) => (
                                    <DropdownMenuItem
                                        key={template.id}
                                        className="cursor-pointer py-2"
                                        onSelect={(event) => {
                                            event.preventDefault()
                                            applyTemplate(template.content)
                                        }}
                                    >
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-semibold text-foreground">{template.name}</div>
                                            <div className="text-[11px] leading-tight text-muted-foreground">{template.description}</div>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>My Templates ({customTemplates.length}/{MAX_CUSTOM_TEMPLATES})</DropdownMenuLabel>
                                {isLoadingTemplates ? (
                                    <div className="px-2 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Loading custom templates...
                                    </div>
                                ) : customTemplates.length === 0 ? (
                                    <div className="px-2 py-2 text-xs text-muted-foreground">
                                        No custom templates yet. Use the + button to save one.
                                    </div>
                                ) : (
                                    customTemplates.map((template) => (
                                        <DropdownMenuItem
                                            key={template.id}
                                            className="cursor-pointer py-2 group"
                                            onSelect={(event) => {
                                                event.preventDefault()
                                                applyTemplate(template.content)
                                            }}
                                        >
                                            <div className="flex w-full items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="truncate text-xs font-semibold text-foreground">{template.name}</div>
                                                    <div className="truncate text-[11px] text-muted-foreground">Saved custom template</div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Delete template ${template.name}`}
                                                    title="Delete template"
                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    disabled={deletingTemplateId === template.id}
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        void handleDeleteCustomTemplate(template.id)
                                                    }}
                                                >
                                                    {deletingTemplateId === template.id ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </div>
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label="Save note as template"
                                        title="Save as template"
                                        className="h-8 w-8 shrink-0 bg-muted/20 disabled:opacity-40"
                                        disabled={isSubmitting || isSavingTemplate || !noteHasContent}
                                        onClick={openSaveTemplateDialog}
                                    >
                                        {isSavingTemplate ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Plus className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                {noteHasContent
                                    ? `Save this note as a custom template (${customTemplates.length}/${MAX_CUSTOM_TEMPLATES})`
                                    : 'Write or insert template content first'}
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    {/* Legacy button templates kept only for quick rollback reference.
                        New dropdown template system above is the active path. */}
                    {/*
                    <Controller
                        name={'comment' as Path<TFieldValues>}
                        control={control}
                        render={({ field }) => (
                            <div className="hidden">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] uppercase font-bold tracking-tight bg-muted/20 shrink-0"
                                    onClick={() => {
                                        field.onChange(insertTemplateIntoNote(field.value, {
                                                "root": {
                                                    "children": [
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Trade Thesis","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","tag":"h3","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Why did I take this trade? What was the higher timeframe context?","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Execution & Logic","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","tag":"h3","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Specific entry trigger, stop loss placement logic, and initial target reasoning.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Results & Management","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","tag":"h3","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"How did the trade play out? Did I manage it according to plan?","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Key Takeaways","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","tag":"h3","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"One thing I did well and one thing I could improve for next time.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}
                                                    ],
                                                    "direction":"ltr","format":"","indent":0,"type":"root","version":1
                                                }
                                            }))
                                    }}
                                >
                                    Standard Review
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] uppercase font-bold tracking-tight bg-muted/20 shrink-0"
                                    onClick={() => {
                                        field.onChange(insertTemplateIntoNote(field.value, {
                                                "root": {
                                                    "children": [
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Emotional State:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" Calm / Anxious / Greedy / FOMO","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Focus Level (1-10): ","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Self-Discipline:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" Did I follow my routine? Did I wait for my setup?","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Mental Notes:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" Any external factors affecting my trading today?","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}
                                                    ],
                                                    "direction":"ltr","format":"","indent":0,"type":"root","version":1
                                                }
                                            }))
                                    }}
                                >
                                    Mental Check-in
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] uppercase font-bold tracking-tight bg-muted/20 shrink-0"
                                    onClick={() => {
                                        field.onChange(insertTemplateIntoNote(field.value, {
                                                "root": {
                                                    "children": [
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"HTF Bias:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" Monthly/Weekly/Daily directional bias.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Entry Framework:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" (e.g., MSS + FVG, Turtle Soup, etc.)","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Risk Management:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" RR ratio, position sizing logic.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},
                                                        {"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Correlation Check:","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" USDX, ES/NQ correlation at time of entry.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}
                                                    ],
                                                    "direction":"ltr","format":"","indent":0,"type":"root","version":1
                                                }
                                            }))
                                    }}
                                >
                                    Technical Breakdown
                                </Button>
                            </div>
                        )}
                    />
                    */}
                </div>
                <Controller
                    name={'comment' as Path<TFieldValues>}
                    control={control}
                    render={({ field }) => (
                        <LexicalEditor
                            value={field.value || ''}
                            onChange={field.onChange}
                            placeholder="Use the prompts as labels and type your answers after each one."
                        />
                    )}
                />
            </div>

            <Dialog
                open={isTemplateNameDialogOpen}
                onOpenChange={(open) => {
                    if (isSavingTemplate) return
                    setIsTemplateNameDialogOpen(open)
                    if (!open) {
                        setTemplateName('')
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save Custom Template</DialogTitle>
                        <DialogDescription>
                            Save the current note structure as a reusable template. You can keep up to {MAX_CUSTOM_TEMPLATES} custom templates.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        placeholder="Template name"
                        value={templateName}
                        maxLength={60}
                        onChange={(event) => setTemplateName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && canSaveTemplate) {
                                event.preventDefault()
                                void handleSaveCurrentAsTemplate()
                            }
                        }}
                    />
                    {templateNameTaken && (
                        <p className="text-xs text-muted-foreground">
                            A template with this name exists. Saving will update it.
                        </p>
                    )}
                    {!templateNameTaken && customTemplates.length >= MAX_CUSTOM_TEMPLATES && (
                        <p className="text-xs text-destructive">
                            You reached the 3-template limit. Use an existing name to replace one.
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsTemplateNameDialogOpen(false)
                                setTemplateName('')
                            }}
                            disabled={isSavingTemplate}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={
                                !canSaveTemplate ||
                                (!templateNameTaken && customTemplates.length >= MAX_CUSTOM_TEMPLATES)
                            }
                            onClick={() => void handleSaveCurrentAsTemplate()}
                        >
                            {isSavingTemplate ? (
                                <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Template'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Card Preview Image */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">Featured Analysis</h3>
                        <p className="text-xs text-muted-foreground">The primary image shown in your journal feed. You can drag and zoom it below so the card preview shows the exact framing you want.</p>
                    </div>
                    <div className="relative">
                        {normalizedCardPreviewImage && String(normalizedCardPreviewImage).trim() !== '' ? (
                            !imageErrors.cardPreviewImage ? (
                                <div className="space-y-3">
                                    <TradePreviewCropEditor
                                        src={normalizedCardPreviewImage}
                                        alt="Featured trade preview"
                                        value={cardPreviewTransform ?? DEFAULT_TRADE_PREVIEW_TRANSFORM}
                                        disabled={isSubmitting || uploadingField === 'cardPreviewImage'}
                                        onError={() => setImageError('cardPreviewImage', true)}
                                        onChange={onPreviewTransformChange}
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="rounded-full border border-border/50 bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            Card preview
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-9 px-4 text-xs font-semibold border-border bg-background/95 hover:bg-accent transition-all"
                                            onClick={() => {
                                                const input = document.createElement('input')
                                                input.type = 'file'
                                                input.accept = 'image/*'
                                                input.onchange = (e) => {
                                                    const file = (e.target as HTMLInputElement).files?.[0]
                                                    if (file) onUpload('cardPreviewImage', file)
                                                }
                                                input.click()
                                            }}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-2" />
                                            Replace
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="h-9 px-4 text-xs font-semibold hover:bg-destructive/90 transition-all"
                                            onClick={() => onRemove('cardPreviewImage')}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Remove
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative aspect-video rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                        <X className="h-8 w-8 text-destructive/50 mb-2" />
                                        <p className="text-xs text-muted-foreground">Image link broken</p>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="aspect-video rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                                <FileDropzone
                                    variant="default"
                                    onDrop={(files) => {
                                        const file = files[0]
                                        if (file) onUpload('cardPreviewImage', file)
                                    }}
                                    accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] }}
                                    className="h-full border-none bg-muted/50 hover:bg-muted/80"
                                    description="Drag & drop or click to upload preview"
                                    icon={<Plus className="h-8 w-8 text-muted-foreground/40 mb-2" />}
                                    disabled={uploadingField === 'cardPreviewImage'}
                                />
                            </div>
                        )}
                        {uploadingField === 'cardPreviewImage' && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80">
                                <Spinner className="h-5 w-5 text-primary" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Screenshots - using the extracted component */}
                <TradeImagesGallery
                    images={images}
                    onUpload={(field, file) => onUpload(field, file)}
                    onRemove={(field) => onRemove(field)}
                    imageErrors={imageErrors}
                    setImageError={setImageError}
                    uploadingField={uploadingField}
                />
            </div>

            {/* Chart Links */}
            <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Chart Analysis Links</h3>
                    <p className="text-xs text-muted-foreground">Add links to your TradingView chart analysis (up to 8)</p>
                </div>
                <div className="space-y-3 max-w-2xl">
                    {chartLinks.map((link, index) => (
                        <div key={index} className="flex items-center gap-2 group">
                            <div className="flex-1">
                                <Input
                                    type="text"
                                    placeholder="https://www.tradingview.com/x/..."
                                    value={link}
                                    onChange={(e) => {
                                        const newLinks = [...chartLinks]
                                        newLinks[index] = e.target.value
                                        setChartLinks(newLinks)
                                    }}
                                    className="text-sm h-9 bg-muted/20 border-border/50 focus:bg-background transition-all"
                                />
                            </div>
                            {index >= 4 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Remove chart link ${index + 1}`}
                                    title="Remove chart link"
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={() => {
                                        const newLinks = chartLinks.filter((_, i) => i !== index)
                                        setChartLinks(newLinks)
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                    {chartLinks.length < 8 && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setChartLinks([...chartLinks, ''])}
                            className="w-full h-9 border-dashed border-border/60 hover:border-primary/50 text-muted-foreground hover:text-primary transition-all"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Analysis Link ({chartLinks.length}/8)
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
