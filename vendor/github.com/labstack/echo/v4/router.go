package echo

import (
	"bytes"
	"net/http"
)

type (
	// Router is the registry of all registered routes for an `Echo` instance for
	// request matching and URL path parameter parsing.
	Router struct {
		tree   *node
		routes map[string]*Route
		echo   *Echo
	}
	node struct {
		kind           kind
		label          byte
		prefix         string
		parent         *node
		staticChildren children
		originalPath   string
		methods        *routeMethods
		paramChild     *node
		anyChild       *node
		paramsCount    int
		// isLeaf indicates that node does not have child routes
		isLeaf bool
		// isHandler indicates that node has at least one handler registered to it
		isHandler bool

		// notFoundHandler is handler registered with RouteNotFound method and is executed for 404 cases
		notFoundHandler *routeMethod
	}
	kind        uint8
	children    []*node
	routeMethod struct {
		ppath   string
		pnames  []string
		handler HandlerFunc
	}
	routeMethods struct {
		connect     *routeMethod
		delete      *routeMethod
		get         *routeMethod
		head        *routeMethod
		options     *routeMethod
		patch       *routeMethod
		post        *routeMethod
		propfind    *routeMethod
		put         *routeMethod
		trace       *routeMethod
		report      *routeMethod
		anyOther    map[string]*routeMethod
		allowHeader string
	}
)

const (
	staticKind kind = iota
	paramKind
	anyKind

	paramLabel = byte(':')
	anyLabel   = byte('*')
)

func (m *routeMethods) isHandler() bool {
	return m.connect != nil ||
		m.delete != nil ||
		m.get != nil ||
		m.head != nil ||
		m.options != nil ||
		m.patch != nil ||
		m.post != nil ||
		m.propfind != nil ||
		m.put != nil ||
		m.trace != nil ||
		m.report != nil ||
		len(m.anyOther) != 0
	// RouteNotFound/404 is not considered as a handler
}

func (m *routeMethods) updateAllowHeader() {
	buf := new(bytes.Buffer)
	buf.WriteString(http.MethodOptions)

	if m.connect != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodConnect)
	}
	if m.delete != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodDelete)
	}
	if m.get != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodGet)
	}
	if m.head != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodHead)
	}
	if m.patch != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodPatch)
	}
	if m.post != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodPost)
	}
	if m.propfind != nil {
		buf.WriteString(", PROPFIND")
	}
	if m.put != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodPut)
	}
	if m.trace != nil {
		buf.WriteString(", ")
		buf.WriteString(http.MethodTrace)
	}
	if m.report != nil {
		buf.WriteString(", REPORT")
	}
	for method := range m.anyOther { // for simplicity, we use map and therefore order is not deterministic here
		buf.WriteString(", ")
		buf.WriteString(method)
	}
	m.allowHeader = buf.String()
}

// NewRouter returns a new Router instance.
func NewRouter(e *Echo) *Router {
	return &Router{
		tree: &node{
			methods: new(routeMethods),
		},
		routes: map[string]*Route{},
		echo:   e,
	}
}

// Add registers a new route for method and path with matching handler.
func (r *Router) Add(method, path string, h HandlerFunc) {
	// Validate path
	if path == "" {
		path = "/"
	}
	if path[0] != '/' {
		path = "/" + path
	}
	pnames := []string{} // Param names
	ppath := path        // Pristine path

	if h == nil && r.echo.Logger != nil {
		// FIXME: in future we should return error
		r.echo.Logger.Errorf("Adding route without handler function: %v:%v", method, path)
	}

	for i, lcpIndex := 0, len(path); i < lcpIndex; i++ {
		if path[i] == ':' {
			if i > 0 && path[i-1] == '\\' {
				path = path[:i-1] + path[i:]
				i--
				lcpIndex--
				continue
			}
			j := i + 1

			r.insert(method, path[:i], staticKind, routeMethod{})
			for ; i < lcpIndex && path[i] != '/'; i++ {
			}

			pnames = append(pnames, path[j:i])
			path = path[:j] + path[i:]
			i, lcpIndex = j, len(path)

			if i == lcpIndex {
				// path node is last fragment of route path. ie. `/users/:id`
				r.insert(method, path[:i], paramKind, routeMethod{ppath, pnames, h})
			} else {
				r.insert(method, path[:i], paramKind, routeMethod{})
			}
		} else if path[i] == '*' {
			r.insert(method, path[:i], staticKind, routeMethod{})
			pnames = append(pnames, "*")
			r.insert(method, path[:i+1], anyKind, routeMethod{ppath, pnames, h})
		}
	}

	r.insert(method, path, staticKind, routeMethod{ppath, pnames, h})
}

func (r *Router) insert(method, path string, t kind, rm routeMethod) {
	// Adjust max param
	paramLen := len(rm.pnames)
	if *r.echo.maxParam < paramLen {
		*r.echo.maxParam = paramLen
	}

	currentNode := r.tree // Current node as root
	if currentNode == nil {
		panic("echo: invalid method")
	}
	search := path

	for {
		searchLen := len(search)
		prefixLen := len(currentNode.prefix)
		lcpLen := 0

		// LCP - Longest Common Prefix (https://en.wikipedia.org/wiki/LCP_array)
		max := prefixLen
		if searchLen < max {
			max = searchLen
		}
		for ; lcpLen < max && search[lcpLen] == currentNode.prefix[lcpLen]; lcpLen++ {
		}

		if lcpLen == 0 {
			// At root node
			currentNode.label = search[0]
			currentNode.prefix = search
			if rm.handler != nil {
				currentNode.kind = t
				currentNode.addMethod(method, &rm)
				currentNode.paramsCount = len(rm.pnames)
				currentNode.originalPath = rm.ppath
			}
			currentNode.isLeaf = currentNode.staticChildren == nil && currentNode.paramChild == nil && currentNode.anyChild == nil
		} else if lcpLen < prefixLen {
			// Split node into two before we insert new node.
			// This happens when we are inserting path that is submatch of any existing inserted paths.
			// For example, we have node `/test` and now are about to insert `/te/*`. In that case
			// 1. overlapping part is `/te` that is used as parent node
			// 2. `st` is part from existing node that is not matching - it gets its own node (child to `/te`)
			// 3. `/*` is the new part we are about to insert (child to `/te`)
			n := newNode(
				currentNode.kind,
				currentNode.prefix[lcpLen:],
				currentNode,
				currentNode.staticChildren,
				currentNode.originalPath,
				currentNode.methods,
				currentNode.paramsCount,
				currentNode.paramChild,
				currentNode.anyChild,
				currentNode.notFoundHandler,
			)
			// Update parent path for all children to new node
			for _, child := range currentNode.staticChildren {
				child.parent = n
			}
			if currentNode.paramChild != nil {
				currentNode.paramChild.parent = n
			}
			if currentNode.anyChild != nil {
				currentNode.anyChild.parent = n
			}

			// Reset parent node
			currentNode.kind = staticKind
			currentNode.label = currentNode.prefix[0]
			currentNode.prefix = currentNode.prefix[:lcpLen]
			currentNode.staticChildren = nil
			currentNode.originalPath = ""
			currentNode.methods = new(routeMethods)
			currentNode.paramsCount = 0
			currentNode.paramChild = nil
			currentNode.anyChild = nil
			currentNode.isLeaf = false
			currentNode.isHandler = false
			currentNode.notFoundHandler = nil

			// Only Static children could reach here
			currentNode.addStaticChild(n)

			if lcpLen == searchLen {
				// At parent node
				currentNode.kind = t
				if rm.handler != nil {
					currentNode.addMethod(method, &rm)
					currentNode.paramsCount = len(rm.pnames)
					currentNode.originalPath = rm.ppath
				}
			} else {
				// Create child node
				n = newNode(t, search[lcpLen:], currentNode, nil, "", new(routeMethods), 0, nil, nil, nil)
				if rm.handler != nil {
					n.addMethod(method, &rm)
					n.paramsCount = len(rm.pnames)
					n.originalPath = rm.ppath
				}
				// Only Static children could reach here
				currentNode.addStaticChild(n)
			}
			currentNode.isLeaf = currentNode.staticChildren == nil && currentNode.paramChild == nil && currentNode.anyChild == nil
		} else if lcpLen < searchLen {
			search = search[lcpLen:]
			c := currentNode.findChildWithLabel(search[0])
			if c != nil {
				// Go deeper
				currentNode = c
				continue
			}
			// Create child node
			n := newNode(t, search, currentNode, nil, rm.ppath, new(routeMethods), 0, nil, nil, nil)
			if rm.handler != nil {
				n.addMethod(method, &rm)
				n.paramsCount = len(rm.pnames)
			}

			switch t {
			case staticKind:
				currentNode.addStaticChild(n)
			case paramKind:
				currentNode.paramChild = n
			case anyKind:
				currentNode.anyChild = n
			}
			currentNode.isLeaf = currentNode.staticChildren == nil && currentNode.paramChild == nil && currentNode.anyChild == nil
		} else {
			// Node already exists
			if rm.handler != nil {
				currentNode.addMethod(method, &rm)
				currentNode.paramsCount = len(rm.pnames)
				currentNode.originalPath = rm.ppath
			}
		}
		return
	}
}

func newNode(
	t kind,
	pre string,
	p *node,
	sc children,
	originalPath string,
	methods *routeMethods,
	paramsCount int,
	paramChildren,
	anyChildren *node,
	notFoundHandler *routeMethod,
) *node {
	return &node{
		kind:            t,
		label:           pre[0],
		prefix:          pre,
		parent:          p,
		staticChildren:  sc,
		originalPath:    originalPath,
		methods:         methods,
		paramsCount:     paramsCount,
		paramChild:      paramChildren,
		anyChild:        anyChildren,
		isLeaf:          sc == nil && paramChildren == nil && anyChildren == nil,
		isHandler:       methods.isHandler(),
		notFoundHandler: notFoundHandler,
	}
}

func (n *node) addStaticChild(c *node) {
	n.staticChildren = append(n.staticChildren, c)
}

func (n *node) findStaticChild(l byte) *node {
	for _, c := range n.staticChildren {
		if c.label == l {
			return c
		}
	}
	return nil
}

func (n *node) findChildWithLabel(l byte) *node {
	if c := n.findStaticChild(l); c != nil {
		return c
	}
	if l == paramLabel {
		return n.paramChild
	}
	if l == anyLabel {
		return n.anyChild
	}
	return nil
}

func (n *node) addMethod(method string, h *routeMethod) {
	switch method {
	case http.MethodConnect:
		n.methods.connect = h
	case http.MethodDelete:
		n.methods.delete = h
	case http.MethodGet:
		n.methods.get = h
	case http.MethodHead:
		n.methods.head = h
	case http.MethodOptions:
		n.methods.options = h
	case http.MethodPatch:
		n.methods.patch = h
	case http.MethodPost:
		n.methods.post = h
	case PROPFIND:
		n.methods.propfind = h
	case http.MethodPut:
		n.methods.put = h
	case http.MethodTrace:
		n.methods.trace = h
	case REPORT:
		n.methods.report = h
	case RouteNotFound:
		n.notFoundHandler = h
		return // RouteNotFound/404 is not considered as a handler so no further logic needs to be executed
	default:
		if n.methods.anyOther == nil {
			n.methods.anyOther = make(map[string]*routeMethod)
		}
		if h.handler == nil {
			delete(n.methods.anyOther, method)
		} else {
			n.methods.anyOther[method] = h
		}
	}

	n.methods.updateAllowHeader()
	n.isHandler = true
}

func (n *node) findMethod(method string) *routeMethod {
	switch method {
	case http.MethodConnect:
		return n.methods.connect
	case http.MethodDelete:
		return n.methods.delete
	case http.MethodGet:
		return n.methods.get
	case http.MethodHead:
		return n.methods.head
	case http.MethodOptions:
		return n.methods.options
	case http.MethodPatch:
		return n.methods.patch
	case http.MethodPost:
		return n.methods.post
	case PROPFIND:
		return n.methods.propfind
	case http.MethodPut:
		return n.methods.put
	case http.MethodTrace:
		return n.methods.trace
	case REPORT:
		return n.methods.report
	default: // RouteNotFound/404 is not considered as a handler
		return n.methods.anyOther[method]
	}
}

func optionsMethodHandler(allowMethods string) func(c Context) error {
	return func(c Context) error {
		// Note: we are not handling most of the CORS headers here. CORS is handled by CORS middleware
		// 'OPTIONS' method RFC: https://httpwg.org/specs/rfc7231.html#OPTIONS
		// 'Allow' header RFC: https://datatracker.ietf.org/doc/html/rfc7231#section-7.4.1
		c.Response().Header().Add(HeaderAllow, allowMethods)
		return c.NoContent(http.StatusNoContent)
	}
}

// Find lookup a handler registered for method and path. It also parses URL for path
// parameters and load them into context.
//
// For performance:
//
// - Get context from `Echo#AcquireContext()`
// - Reset it `Context#Reset()`
// - Return it `Echo#ReleaseContext()`.
func (r *Router) Find(method, path string, c Context) {
	ctx := c.(*context)
	ctx.path = path
	currentNode := r.tree // Current node as root

	var (
		previousBestMatchNode *node
		matchedRouteMethod    *routeMethod
		// search stores the remaining path to check for match. By each iteration we move from start of path to end of the path
		// and search value gets shorter and shorter.
		search      = path
		searchIndex = 0
		paramIndex  int           // Param counter
		paramValues = ctx.pvalues // Use the internal slice so the interface can keep the illusion of a dynamic slice
	)

	// Backtracking is needed when a dead end (leaf node) is reached in the router tree.
	// To backtrack the current node will be changed to the parent node and the next kind for the
	// router logic will be returned based on fromKind or kind of the dead end node (static > param > any).
	// For example if there is no static node match we should check parent next sibling by kind (param).
	// Backtracking itself does not check if there is a next sibling, this is done by the router logic.
	backtrackToNextNodeKind := func(fromKind kind) (nextNodeKind kind, valid bool) {
		previous := currentNode
		currentNode = previous.parent
		valid = currentNode != nil

		// Next node type by priority
		if previous.kind == anyKind {
			nextNodeKind = staticKind
		} else {
			nextNodeKind = previous.kind + 1
		}

		if fromKind == staticKind {
			// when backtracking is done from static kind block we did not change search so nothing to restore
			return
		}

		// restore search to value it was before we move to current node we are backtracking from.
		if previous.kind == staticKind {
			searchIndex -= len(previous.prefix)
		} else {
			paramIndex--
			// for param/any node.prefix value is always `:` so we can not deduce searchIndex from that and must use pValue
			// for that index as it would also contain part of path we cut off before moving into node we are backtracking from
			searchIndex -= len(paramValues[paramIndex])
			paramValues[paramIndex] = ""
		}
		search = path[searchIndex:]
		return
	}

	// Router tree is implemented by longest common prefix array (LCP array) https://en.wikipedia.org/wiki/LCP_array
	// Tree search is implemented as for loop where one loop iteration is divided into 3 separate blocks
	// Each of these blocks checks specific kind of node (static/param/any). Order of blocks reflex their priority in routing.
	// Search order/priority is: static > param > any.
	//
	// Note: backtracking in tree is implemented by replacing/switching currentNode to previous node
	// and hoping to (goto statement) next block by priority to check if it is the match.
	for {
		prefixLen := 0 // Prefix length
		lcpLen := 0    // LCP (longest common prefix) length

		if currentNode.kind == staticKind {
			searchLen := len(search)
			prefixLen = len(currentNode.prefix)

			// LCP - Longest Common Prefix (https://en.wikipedia.org/wiki/LCP_array)
			max := prefixLen
			if searchLen < max {
				max = searchLen
			}
			for ; lcpLen < max && search[lcpLen] == currentNode.prefix[lcpLen]; lcpLen++ {
			}
		}

		if lcpLen != prefixLen {
			// No matching prefix, let's backtrack to the first possible alternative node of the decision path
			nk, ok := backtrackToNextNodeKind(staticKind)
			if !ok {
				return // No other possibilities on the decision path, handler will be whatever context is reset to.
			} else if nk == paramKind {
				goto Param
				// NOTE: this case (backtracking from static node to previous any node) can not happen by current any matching logic. Any node is end of search currently
				//} else if nk == anyKind {
				//	goto Any
			} else {
				// Not found (this should never be possible for static node we are looking currently)
				break
			}
		}

		// The full prefix has matched, remove the prefix from the remaining search
		search = search[lcpLen:]
		searchIndex = searchIndex + lcpLen

		// Finish routing if is no request path remaining to search
		if search == "" {
			// in case of node that is handler we have exact method type match or something for 405 to use
			if currentNode.isHandler {
				// check if current node has handler registered for http method we are looking for. we store currentNode as
				// best matching in case we do no find no more routes matching this path+method
				if previousBestMatchNode == nil {
					previousBestMatchNode = currentNode
				}
				if h := currentNode.findMethod(method); h != nil {
					matchedRouteMethod = h
					break
				}
			} else if currentNode.notFoundHandler != nil {
				matchedRouteMethod = currentNode.notFoundHandler
				break
			}
		}

		// Static node
		if search != "" {
			if child := currentNode.findStaticChild(search[0]); child != nil {
				currentNode = child
				continue
			}
		}

	Param:
		// Param node
		if child := currentNode.paramChild; search != "" && child != nil {
			currentNode = child
			i := 0
			l := len(search)
			if currentNode.isLeaf {
				// when param node does not have any children (path param is last piece of route path) then param node should
				// act similarly to any node - consider all remaining search as match
				i = l
			} else {
				for ; i < l && search[i] != '/'; i++ {
				}
			}

			paramValues[paramIndex] = search[:i]
			paramIndex++
			search = search[i:]
			searchIndex = searchIndex + i
			continue
		}

	Any:
		// Any node
		if child := currentNode.anyChild; child != nil {
			// If any node is found, use remaining path for paramValues
			currentNode = child
			paramValues[currentNode.paramsCount-1] = search

			// update indexes/search in case we need to backtrack when no handler match is found
			paramIndex++
			searchIndex += +len(search)
			search = ""

			if h := currentNode.findMethod(method); h != nil {
				matchedRouteMethod = h
				break
			}
			// we store currentNode as best matching in case we do not find more routes matching this path+method. Needed for 405
			if previousBestMatchNode == nil {
				previousBestMatchNode = currentNode
			}
			if currentNode.notFoundHandler != nil {
				matchedRouteMethod = currentNode.notFoundHandler
				break
			}
		}

		// Let's backtrack to the first possible alternative node of the decision path
		nk, ok := backtrackToNextNodeKind(anyKind)
		if !ok {
			break // No other possibilities on the decision path
		} else if nk == paramKind {
			goto Param
		} else if nk == anyKind {
			goto Any
		} else {
			// Not found
			break
		}
	}

	if currentNode == nil && previousBestMatchNode == nil {
		return // nothing matched at all
	}

	// matchedHandler could be method+path handler that we matched or notFoundHandler from node with matching path
	// user provided not found (404) handler has priority over generic method not found (405) handler or global 404 handler
	var rPath string
	var rPNames []string
	if matchedRouteMethod != nil {
		rPath = matchedRouteMethod.ppath
		rPNames = matchedRouteMethod.pnames
		ctx.handler = matchedRouteMethod.handler
	} else {
		// use previous match as basis. although we have no matching handler we have path match.
		// so we can send http.StatusMethodNotAllowed (405) instead of http.StatusNotFound (404)
		currentNode = previousBestMatchNode

		rPath = currentNode.originalPath
		rPNames = nil // no params here
		ctx.handler = NotFoundHandler
		if currentNode.notFoundHandler != nil {
			rPath = currentNode.notFoundHandler.ppath
			rPNames = currentNode.notFoundHandler.pnames
			ctx.handler = currentNode.notFoundHandler.handler
		} else if currentNode.isHandler {
			ctx.Set(ContextKeyHeaderAllow, currentNode.methods.allowHeader)
			ctx.handler = MethodNotAllowedHandler
			if method == http.MethodOptions {
				ctx.handler = optionsMethodHandler(currentNode.methods.allowHeader)
			}
		}
	}
	ctx.path = rPath
	ctx.pnames = rPNames
}
