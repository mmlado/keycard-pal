import { createContext, useContext, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

export type SettingsField = ComponentRef<typeof TextInput>;
export type FieldFocusHandler = (field: SettingsField | null) => void;

/**
 * Lets a settings field hand itself to the screen that owns the ScrollView,
 * which is the only place that can scroll it clear of the keyboard. A context
 * rather than a prop because the fields sit three components deep.
 */
export const FieldFocusContext = createContext<FieldFocusHandler>(() => {});

export function useFieldFocus(): FieldFocusHandler {
  return useContext(FieldFocusContext);
}
