import {
  ClassicTemplate,
  LetterTemplate,
  NotebookTemplate,
  PolaroidTemplate,
  StickyNoteTemplate,
} from "@/components/postcard/templates/PostcardTemplates"

export const templateComponents = {
  classic: ClassicTemplate,
  polaroid: PolaroidTemplate,
  notebook: NotebookTemplate,
  "sticky-note": StickyNoteTemplate,
  letter: LetterTemplate,
}
