import 'babel-polyfill'
import Room from 'ipfs-pubsub-room'
import IPFS from 'ipfs'
import ko from 'knockout'
import queryString from 'query-string'

// Global references for demo purposes
let ipfs
let viewModel

const setup = async() => {
    // Create view model with properties to control chat
    function ViewModel() {
        let self = this
            // Stores username
        self.name = ko.observable('')
            // Stores current message
        self.message = ko.observable('')
            // Stores array of messages
        self.messages = ko.observableArray([])
            // Stores local peer id
        self.id = ko.observable(null)
            // Stores whether we've successfully subscribed to the room
        self.subscribed = ko.observable(false)
            // Logs latest error (just there in case we want it)
        self.error = ko.observable(null)
            // We compute the ipns link on the fly from the peer id
        self.url = ko.pureComputed(() => {
            return `https://ipfs.io/ipns/${self.id()}`
        })
    }
    // Create default view model used for binding ui elements etc.
    viewModel = new ViewModel()
        // Apply default bindings
    ko.applyBindings(viewModel)
    window.viewModel = viewModel // Just for demo purposes later!

    try {
        ipfs = new IPFS({
            // We need to enable pubsub...
            EXPERIMENTAL: {
                pubsub: true
            },
            config: {
                Addresses: {
                    // ...And supply swarm address to announce on
                    Swarm: [
                        '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
                    ]
                }
            }
        })
    } catch (err) {
        console.error('Failed to initialize peer', err)
        viewModel.error(err) // Log error...
    }

    try {
        ipfs.on('ready', async() => {
            const id = await ipfs.id()
                // Update view model
            viewModel.id(id.id)
                // Can also use query string to specify, see github example
            const roomID = "test-room-1234"
                // Create basic room for given room id
            const room = Room(ipfs, roomID)
                // Once the peer has subscribed to the room, we enable chat,
                // which is bound to the view model's subscribe
            room.on('subscribed', () => {
                    // Update view model
                    viewModel.subscribed(true)
                })
                // When we receive a message...
            room.on('message', (msg) => {
                    const data = JSON.parse(msg.data) // Parse data (which is JSON)
                        // Update msg name (default to anonymous)
                    msg.name = data.name ? data.name : "anonymous"
                        // Update msg text (just for simplicity later)
                    msg.text = data.text
                        // Add this to _front_ of array to keep at bottom
                    viewModel.messages.unshift(msg)
                })
                // Subscribe to message changes on our view model, likely the result
                // of user interaction
            viewModel.message.subscribe(async(text) => {
                    // If not actually subscribed or no text, skip out
                    if (!viewModel.subscribed() || !text) return
                    try {
                        // Get current name
                        const name = viewModel.name()
                            // Get current message (one that initiated this update)
                        const msg = viewModel.message()
                            // Broadcast message to entire room as JSON string
                        room.broadcast(Buffer.from(JSON.stringify({ name, text })))
                    } catch (err) {
                        console.error('Failed to publish message', err)
                        viewModel.error(err)
                    }
                    // Empty message in view model
                    viewModel.message('')
                })
                // Leave the room when we unload
            window.addEventListener('unload', async() => await room.leave())
        })
    } catch (err) {
        console.error('Failed to setup chat room', err)
        viewModel.error(err)
    }
    console.log("Ready for chat!")
}
setup()