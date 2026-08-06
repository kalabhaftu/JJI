'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import { Plus, X, AlertTriangle as Warning, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { reportClientError } from '@/lib/observability/report-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type RuleCategory = 'entry' | 'target' | 'confirmation' | 'confluence' | 'exit' | 'risk' | 'general'

interface Rule {
  text: string
  category: RuleCategory
}

const DEFAULT_RULES: Rule[] = [
  { text: '', category: 'entry' },
  { text: '', category: 'target' },
  { text: '', category: 'confirmation' },
  { text: '', category: 'confluence' }
]

const RULE_CATEGORIES: { value: RuleCategory; label: string; placeholder: string }[] = [
  { value: 'entry', label: 'Entry', placeholder: 'What must be true before entering?' },
  { value: 'target', label: 'Target', placeholder: 'Where is the trade expected to reach?' },
  { value: 'confirmation', label: 'Confirm', placeholder: 'What confirms execution?' },
  { value: 'confluence', label: 'Confluence', placeholder: 'What supporting factors strengthen the setup?' },
  { value: 'exit', label: 'Exit', placeholder: 'Legacy exit rule...' },
  { value: 'risk', label: 'Risk', placeholder: 'Legacy risk rule...' },
  { value: 'general', label: 'General', placeholder: 'Define specific condition...' },
]

const normalizeRule = (rule: Rule | string): Rule => {
  if (typeof rule === 'string') return { text: rule, category: 'general' }
  const category = RULE_CATEGORIES.some(item => item.value === rule.category) ? rule.category : 'general'
  return { text: rule.text || '', category }
}

const normalizeSetups = (value?: string[]) => Array.isArray(value) ? value.filter(Boolean) : []

interface TradingModel {
  id: string
  name: string
  rules: (Rule | string)[]
  setups?: string[]
  notes?: string | null
  createdAt: string
  updatedAt: string
}

interface AddEditModelModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; rules: Rule[]; setups?: string[]; notes?: string | null }) => Promise<void>
  model?: TradingModel | null
  mode: 'add' | 'edit'
}

export function AddEditModelModal({ isOpen, onClose, onSave, model, mode }: AddEditModelModalProps) {
  const [name, setName] = useState('')
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES)
  const [setups, setSetups] = useState<string[]>([])
  const [newSetup, setNewSetup] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && model) {
        setName(model.name)

        const modelRules = Array.isArray(model.rules) ? model.rules : []
        const formattedRules = modelRules.map(normalizeRule)
        setRules(formattedRules.length > 0 ? [...formattedRules] : DEFAULT_RULES)
        setSetups(normalizeSetups(model.setups))
        setNotes(model.notes || '')
      } else {
        setName('')
        setRules(DEFAULT_RULES)
        setSetups([])
        setNewSetup('')
        setNotes('')
      }
      setHasChanges(false)
    }
  }, [isOpen, model, mode])

  useEffect(() => {
    if (!isOpen) return

    if (mode === 'edit' && model) {
      const nameChanged = name !== model.name
      const currentRules = rules.filter(r => r.text.trim()).map(normalizeRule)
      const modelRules = (model.rules || []).map(normalizeRule)
      const currentSetups = normalizeSetups(setups)
      const modelSetups = normalizeSetups(model.setups)

      const rulesChanged = JSON.stringify(currentRules) !== JSON.stringify(modelRules)
      const setupsChanged = JSON.stringify(currentSetups) !== JSON.stringify(modelSetups)
      const notesChanged = notes !== (model.notes || '')
      setHasChanges(nameChanged || rulesChanged || setupsChanged || notesChanged)
    } else {
      setHasChanges(name.trim() !== '' || rules.some(r => r.text.trim() !== '') || setups.length > 0 || notes.trim() !== '')
    }
  }, [name, rules, setups, notes, model, mode, isOpen])

  const handleAddRule = () => {
    setRules([...rules, { text: '', category: 'general' }])
  }

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const handleRuleChange = (index: number, field: keyof Rule, value: string) => {
    const newRules = [...rules]
    const currentRule = newRules[index]
    if (!currentRule) return
    const updatedRule: Rule = { ...currentRule }
    if (field === 'category') {
      updatedRule.category = value as RuleCategory
    } else {
      updatedRule.text = value
    }
    newRules[index] = updatedRule
    setRules(newRules)
  }

  const handleClose = () => {
    if (hasChanges) {
      setShowUnsavedWarning(true)
    } else {
      onClose()
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Model name is required')
      return
    }

    setIsSaving(true)
    try {
      const filteredRules = rules.filter(rule => rule.text.trim() !== '')
      await onSave({
        name: name.trim(),
        rules: filteredRules,
        setups: setups.filter(s => s.trim()),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      toast.success(mode === 'add' ? 'Model created successfully' : 'Model updated successfully')
      onClose()
    } catch (error) {
      reportClientError(error, { operation: 'save-playbook-model', route: '/api/v1/playbook/models' })
      toast.error(error instanceof Error ? error.message : 'Failed to save model')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-background border-border/40">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-2xl font-black tracking-tighter uppercase">
              {mode === 'add' ? 'INITIALIZE STRATEGY' : 'REFINE STRATEGY'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
              {mode === 'add'
                ? 'Building a systematic framework for risk and execution'
                : `Updating protocol: ${model?.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8 py-4">
            {                }
            <div className="space-y-3">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                Strategy Designation <span className="text-destructive">*</span>
              </Label>
                <Input
                  id="name"
                  aria-label="Strategy Designation"
                  placeholder="e.g., HTF EQUILIBRIUM, SMART MONEY CONCEPTS"
                  className="font-bold tracking-tight h-11 bg-muted/10 border-border/40 focus:border-primary/50 transition-all uppercase"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
            </div>

            {           }
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Execution Protocol (Rules)</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddRule}
                  className="h-8 px-3 font-black uppercase tracking-tighter text-[10px]"
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Append Rule
                </Button>
              </div>
              <div className="space-y-3">
                {rules.map((rule, index) => {
                  const category = RULE_CATEGORIES.find(item => item.value === rule.category) || RULE_CATEGORIES[RULE_CATEGORIES.length - 1]
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <Select value={rule.category} onValueChange={(v) => handleRuleChange(index, 'category', v as RuleCategory)}>
                        <SelectTrigger className="h-10 w-[118px] shrink-0 text-[10px] font-black uppercase tracking-tighter border-border/40 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_CATEGORIES.map(item => (
                            <SelectItem key={item.value} value={item.value} className="text-[10px] font-bold uppercase">
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={category?.placeholder}
                        className="font-medium text-sm h-10 bg-muted/10 border-border/40"
                        value={rule.text}
                        onChange={(e) => handleRuleChange(index, 'text', e.target.value)}
                        maxLength={100}
                      />
                      <Button
                        type="button"
                        variant="tertiary"
                        size="icon"
                        aria-label={`Remove rule ${index + 1}`}
                        title="Remove rule"
                        onClick={() => handleRemoveRule(index)}
                        className="h-10 w-10 shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-medium italic">
                Structured protocols ensure consistency. Define Entry, Target, Confirmation, and Confluence rules for the setup.
              </p>
            </div>

            {            }
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Trade Setups</Label>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-medium italic">
                Define specific setups within this strategy (e.g., &quot;A+ Breakout&quot;, &quot;Failed Reversal&quot;, &quot;Liquidity Grab&quot;). You can tag trades with these setups later.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g., A+ Breakout"
                  className="font-medium text-sm h-9 bg-muted/10 border-border/40"
                  value={newSetup}
                  onChange={(e) => setNewSetup(e.target.value)}
                  maxLength={50}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSetup.trim()) {
                      e.preventDefault()
                      if (!setups.includes(newSetup.trim())) {
                        setSetups([...setups, newSetup.trim()])
                      }
                      setNewSetup('')
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (newSetup.trim() && !setups.includes(newSetup.trim())) {
                      setSetups([...setups, newSetup.trim()])
                      setNewSetup('')
                    }
                  }}
                  disabled={!newSetup.trim()}
                  className="h-9 px-3 font-black uppercase tracking-tighter text-[10px] shrink-0"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {setups.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {setups.map((setup, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
                      <span className="text-[11px] font-bold text-primary">{setup}</span>
                      <button
                        type="button"
                        aria-label={`Remove setup ${setup}`}
                        onClick={() => setSetups(setups.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes (Optional)
              </Label>
              <LexicalEditor
                placeholder="Add any additional notes about this model..."
                value={notes}
                onChange={setNotes}
                minHeight="150px"
              />
              <p className="text-xs text-muted-foreground">
                {notes.length}/1000 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
              {isSaving ? 'Saving...' : mode === 'add' ? 'Create Model' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {                             }
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-warning" />
              Unsaved Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedWarning(false)}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedWarning(false)
                onClose()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
