import { STUDIO_RUNTIME_VIEWS, type StudioProjectView, type StudioRuntimeView } from '@/stores/studio-shell-store';

export const isRuntimeView = (view: StudioProjectView): view is StudioRuntimeView =>
  STUDIO_RUNTIME_VIEWS.includes(view as StudioRuntimeView);
