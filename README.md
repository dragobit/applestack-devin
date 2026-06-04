# Applestack

**Production-Ready Nostr Client Framework**

Applestack is a modern framework for building Nostr applications with React 18.x, TailwindCSS 3.x, Vite, shadcn/ui, and Applesauce. Build powerful, reactive Nostr applications - from social feeds to private messaging, Applestack provides everything you need to create decentralized apps on the Nostr protocol.

## 🚀 Quick Start

Get started with Applestack:

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/applestack.git
cd applestack
pnpm install
```

### 2. Start Development

```bash
pnpm run dev
# Visit http://localhost:5173
```

### 3. Build for Production

```bash
pnpm run build
pnpm run preview
```

## ✨ What Makes Applestack Special

- **⚡ Reactive Architecture**: Built on Applesauce v6 with RxJS for real-time updates
- **🎨 Beautiful UI**: 48+ shadcn/ui components with light/dark theme support
- **🔐 Built-in Security**: NIP-07 browser signing, NIP-44 encryption, event validation
- **💰 Payments Ready**: Lightning zaps (NIP-57) with built-in wallet support
- **📱 Production Ready**: TypeScript, testing, and responsive design included
- **🔄 Smart Caching**: EventStore with efficient event management and loaders
- **🧩 Type-Safe Casts**: Note, User, Reaction, and Zap casts with computed properties

## 🛠 Technology Stack

- **React 18.x**: Stable version with hooks, concurrent rendering, and improved performance
- **TailwindCSS 3.x**: Utility-first CSS framework for styling
- **Vite**: Fast build tool and development server
- **shadcn/ui**: 48+ unstyled, accessible UI components built with Radix UI
- **Applesauce v6**: Production-ready Nostr SDK with reactive architecture
- **RxJS**: Reactive programming with observables for real-time state management
- **React Router**: Client-side routing with BrowserRouter
- **TypeScript**: Type-safe JavaScript development

## 🎯 Key Features

Applestack provides a complete foundation for building Nostr applications with:

- **Reactive Data Flow**: RxJS observables for real-time event updates
- **Smart Event Management**: EventStore with efficient caching and queries
- **Type-Safe Casts**: Note, User, Reaction, Zap with computed properties
- **Powerful Models**: ProfileModel, ThreadModel, CommentsModel for complex data
- **Multi-Relay Support**: RelayPool with automatic connection management
- **Built-in Loaders**: Infinite scroll, event loading, and pagination support

## 🔧 Core Features

### Authentication & Users

- `LoginArea` component with account switching
- `useAccount` hook for authentication state
- `useUser` and `useProfile` hooks for user data
- NIP-07 browser signing support
- Multi-account management with extension, nsec, and bunker support

### Nostr Protocol Support

- **Social Features**: User profiles (NIP-01), follow lists (NIP-02), reactions (NIP-25)
- **Messaging**: Private DMs (NIP-04, NIP-17) with encryption (NIP-44)
- **Payments**: Lightning zaps (NIP-57) with wallet integration
- **Content**: Long-form articles (NIP-23), calendars (NIP-52), and custom kinds

### Data Management with Applesauce

- `useTimeline` hook for reactive event feeds
- `usePublish` hook for event publishing with automatic client tagging
- `use$` hook for subscribing to RxJS observables
- `useEventStore` for accessing the global event store
- Event validation and filtering with type-safe casts
- Built-in loaders for infinite scroll and pagination

### UI Components

- 48+ shadcn/ui components (buttons, forms, dialogs, etc.)
- Authentication components (LoginDialog, SignupDialog, AccountSwitcher)
- NIP-65 relay management with RelayListManager
- Light/dark theme system with `useTheme` hook
- Toast notifications with `useToast`
- Responsive design with `useIsMobile` hook

### Advanced Features

- NIP-19 identifier routing (`npub1`, `note1`, `nevent1`, `naddr1`)
- Cryptographic operations (NIP-44 encryption/decryption)
- Lightning payments and zaps
- Real-time event subscriptions with RxJS
- ThreadModel and CommentsModel for discussions
- Responsive design with mobile support

## 📖 Core Hooks

Applestack provides powerful React hooks built on Applesauce:

### Event Management

- **`use$`**: Subscribe to RxJS observables with automatic cleanup
- **`useEventStore`**: Access the global EventStore instance
- **`useTimeline`**: Subscribe to live event timelines from relays
- **`useLocalTimeline`**: Query events from local EventStore only

### User & Authentication

- **`useAccount`**: Get the currently logged-in account
- **`useUser`**: Create a User cast with reactive profile and contacts
- **`useProfile`**: Get user profile metadata (uses User cast internally)
- **`useMyUser`**: Get current user's User cast
- **`useLoginActions`**: Access login methods (extension, nsec, bunker)

### Publishing & Actions

- **`usePublish`**: Publish events with automatic signing
- **`useAction`**: Execute pre-built actions (CreateNote, FollowUser, etc.)

### Utilities

- **`useTheme`**: Theme management (light/dark mode)
- **`useToast`**: Toast notifications
- **`useIsMobile`**: Responsive design helper
- **`useLocalStorage`**: Persistent local storage

## 📁 Project Structure

```
src/
├── components/           # UI components
│   ├── ui/              # shadcn/ui components (48+ available)
│   └── auth/            # Authentication components (LoginArea, LoginDialog, etc.)
├── services/            # Applesauce core services
│   ├── stores.ts        # EventStore instance
│   ├── pool.ts          # RelayPool instance
│   ├── accounts.ts      # Account manager
│   ├── loaders.ts       # Event loaders
│   └── actions.ts       # Pre-built actions
├── hooks/               # Custom React hooks
│   ├── use$             # Subscribe to observables
│   ├── useEventStore    # Access EventStore
│   ├── useAccount       # Authentication state
│   ├── useUser          # User cast
│   ├── useProfile       # User profile data
│   ├── useTimeline      # Event timeline
│   ├── usePublish       # Event publishing
│   ├── useAction        # Execute actions
│   └── useTheme         # Theme management
├── pages/               # Page components
├── lib/                 # Utility functions
├── types/               # TypeScript type definitions
└── test/                # Testing utilities (TestApp)
```

## 🎨 UI Components

MKStack includes 48+ shadcn/ui components:

**Layout**: Card, Separator, Sheet, Sidebar, ScrollArea, Resizable
**Navigation**: Breadcrumb, NavigationMenu, Menubar, Tabs, Pagination
**Forms**: Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Slider
**Feedback**: Alert, AlertDialog, Toast, Progress, Skeleton
**Overlay**: Dialog, Popover, HoverCard, Tooltip, ContextMenu, DropdownMenu
**Data Display**: Table, Avatar, Badge, Calendar, Chart, Carousel
\*\*And many more...

## 🔐 Security & Best Practices

- **Never use `any` type**: Always use proper TypeScript types
- **Event validation**: Filter events through validator functions for custom kinds
- **Efficient queries**: Minimize separate queries to avoid rate limiting
- **Proper error handling**: Graceful handling of invalid NIP-19 identifiers
- **Secure authentication**: Use signer interface, never request private keys directly

## 📱 Responsive Design

- Mobile-first approach with Tailwind breakpoints
- `useIsMobile` hook for responsive behavior
- Touch-friendly interactions
- Optimized for all screen sizes

## 🧪 Testing

- Vitest with jsdom environment
- React Testing Library with jest-dom matchers
- `TestApp` component provides all necessary context providers
- Mocked browser APIs (matchMedia, scrollTo, IntersectionObserver, ResizeObserver)

## 🏗️ Building & Deployment

Build your Applestack app for production:

```bash
pnpm run build       # Build for production
npm run preview     # Preview production build locally
```

Deploy to your preferred platform:

- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy --prod`
- **GitHub Pages**: Configure in your repository settings
- **Custom Server**: Serve the `dist` folder

## 📚 Documentation

For detailed documentation on building Nostr applications:

- **Project Docs**: See `docs/` directory for implementation guides
  - `docs/AI_CHAT.md`: Building AI-powered chat interfaces
  - `docs/NOSTR_COMMENTS.md`: Implementing comment systems
  - `docs/NOSTR_INFINITE_SCROLL.md`: Feed interfaces with pagination
  - `docs/NOSTR_DIRECT_MESSAGES.md`: Direct messaging (NIP-04/NIP-17)
- **Applesauce**: [GitHub Repository](https://github.com/hzrd149/applesauce)
- **Nostr Protocol**: [nostr.com](https://nostr.com)
- **shadcn/ui**: [ui.shadcn.com](https://ui.shadcn.com)

## 🤝 Contributing

Applestack is open source and welcomes contributions. The framework is designed to be:

- **Extensible**: Easy to add new NIPs and features with Applesauce
- **Maintainable**: Clean reactive architecture with TypeScript
- **Testable**: Comprehensive testing setup with Vitest and Testing Library
- **Documented**: Clear patterns and implementation guides in `docs/`

To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes following the project patterns
4. Ensure tests pass with `pnpm test`
5. Submit a pull request

## 📄 License

MIT License - Open source and free to use. Build amazing Nostr applications and help grow the decentralized web!

---

**Built with Applestack** - A production-ready Nostr client framework powered by Applesauce v6.

_Reactive, type-safe, and ready for production._
