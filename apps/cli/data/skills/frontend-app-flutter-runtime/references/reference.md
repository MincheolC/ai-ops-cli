# Frontend App Flutter Runtime

## Flutter Constraints

- Do not use dynamic as a default type.
- Do not put business logic in `Widget build()`.
- Do not use StatefulWidget for shared or long-lived state.
- Do not use GlobalKey to reach into child state for app data flow.
- Do not keep mutable model fields.
- Do not run heavy synchronous work on the UI thread.

## Flutter Guidelines

- Use Riverpod with code generation and feature-local providers.
- Use feature-first directories and keep shared code in `lib/core`.
- Use sealed classes and pattern matching for result and async state handling.
- Prefer const constructors where possible.
- Use go_router for declarative routes and deep links.
- Use freezed for immutable models and generated equality and JSON methods.
- Write widget tests with `ProviderScope.overrides`.
- Profile with DevTools before optimizing.
- Handle async states explicitly.
- Access external APIs and storage through repositories.

## App Frontend Library Constraints

- Do not use the `http` package for API calls.
- Do not use Provider or Bloc.
- Do not handwrite data classes.
- Do not use Navigator 1.0 push/pop APIs for routing.
- Do not manually implement JSON serialization.

## App Frontend Library Guidelines

- Use `@riverpod` with riverpod_generator and build_runner.
- Use freezed for immutable models and unions.
- Define routes in a central GoRouter config.
- Create one shared Dio instance via Riverpod DI.
- Use shared_preferences or flutter_secure_storage by data sensitivity.
- Use cached_network_image for network image caching.
- Use very_good_analysis and treat warnings as CI failures.
- Use intl or easy_localization with ARB-based translations.

## Decision Rules

- When state is local and ephemeral, keep it local.
- When state is shared or long-lived, use Riverpod Notifier or AsyncNotifier.
- When HTTP API calls are needed, use one DI-injected Dio client.
- When network images are rendered, use cached_network_image.
- When code generation is required, run build_runner instead of editing generated code.
