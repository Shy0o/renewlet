package static

import "embed"

// Files contains the Vite build output. During Docker builds this directory is
// replaced with packages/client/dist before compiling the Go binary.
//
//go:embed all:public
var Files embed.FS

//go:embed data/thesvg-index.json
var TheSVGIndex []byte
