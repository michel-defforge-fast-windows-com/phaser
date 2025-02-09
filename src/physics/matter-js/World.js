/**
 * @author       Richard Davey <rich@photonstorm.com>
 * @copyright    2019 Photon Storm Ltd.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var Bodies = require('./lib/factory/Bodies');
var Body = require('./lib/body/Body');
var Class = require('../../utils/Class');
var Common = require('./lib/core/Common');
var Composite = require('./lib/body/Composite');
var Engine = require('./lib/core/Engine');
var EventEmitter = require('eventemitter3');
var Events = require('./events');
var GetFastValue = require('../../utils/object/GetFastValue');
var GetValue = require('../../utils/object/GetValue');
var MatterBody = require('./lib/body/Body');
var MatterEvents = require('./lib/core/Events');
var MatterTileBody = require('./MatterTileBody');
var MatterWorld = require('./lib/body/World');
var Vector = require('./lib/geometry/Vector');

/**
 * @classdesc
 * [description]
 *
 * @class World
 * @extends Phaser.Events.EventEmitter
 * @memberof Phaser.Physics.Matter
 * @constructor
 * @since 3.0.0
 *
 * @param {Phaser.Scene} scene - The Scene to which this Matter World instance belongs.
 * @param {Phaser.Types.Physics.Matter.MatterWorldConfig} config - The Matter World configuration object.
 */
var World = new Class({

    Extends: EventEmitter,

    initialize:

    function World (scene, config)
    {
        EventEmitter.call(this);

        /**
         * The Scene to which this Matter World instance belongs.
         *
         * @name Phaser.Physics.Matter.World#scene
         * @type {Phaser.Scene}
         * @since 3.0.0
         */
        this.scene = scene;

        /**
         * An instance of the MatterJS Engine.
         *
         * @name Phaser.Physics.Matter.World#engine
         * @type {MatterJS.Engine}
         * @since 3.0.0
         */
        this.engine = Engine.create(config);

        /**
         * A `World` composite object that will contain all simulated bodies and constraints.
         *
         * @name Phaser.Physics.Matter.World#localWorld
         * @type {MatterJS.World}
         * @since 3.0.0
         */
        this.localWorld = this.engine.world;

        var gravity = GetValue(config, 'gravity', null);

        if (gravity)
        {
            this.setGravity(gravity.x, gravity.y, gravity.scale);
        }

        /**
         * An object containing the 4 wall bodies that bound the physics world.
         *
         * @name Phaser.Physics.Matter.World#walls
         * @type {object}
         * @since 3.0.0
         */
        this.walls = { left: null, right: null, top: null, bottom: null };

        if (GetFastValue(config, 'setBounds', false))
        {
            var boundsConfig = config['setBounds'];

            if (typeof boundsConfig === 'boolean')
            {
                this.setBounds();
            }
            else
            {
                var x = GetFastValue(boundsConfig, 'x', 0);
                var y = GetFastValue(boundsConfig, 'y', 0);
                var width = GetFastValue(boundsConfig, 'width', scene.sys.scale.width);
                var height = GetFastValue(boundsConfig, 'height', scene.sys.scale.height);
                var thickness = GetFastValue(boundsConfig, 'thickness', 64);
                var left = GetFastValue(boundsConfig, 'left', true);
                var right = GetFastValue(boundsConfig, 'right', true);
                var top = GetFastValue(boundsConfig, 'top', true);
                var bottom = GetFastValue(boundsConfig, 'bottom', true);

                this.setBounds(x, y, width, height, thickness, left, right, top, bottom);
            }
        }

        /**
         * A flag that toggles if the world is enabled or not.
         *
         * @name Phaser.Physics.Matter.World#enabled
         * @type {boolean}
         * @default true
         * @since 3.0.0
         */
        this.enabled = GetValue(config, 'enabled', true);

        /**
         * The correction argument is an optional Number that specifies the time correction factor to apply to the update.
         * This can help improve the accuracy of the simulation in cases where delta is changing between updates.
         * The value of correction is defined as delta / lastDelta, i.e. the percentage change of delta over the last step.
         * Therefore the value is always 1 (no correction) when delta constant (or when no correction is desired, which is the default).
         * See the paper on Time Corrected Verlet for more information.
         *
         * @name Phaser.Physics.Matter.World#correction
         * @type {number}
         * @default 1
         * @since 3.4.0
         */
        this.correction = GetValue(config, 'correction', 1);

        /**
         * This function is called every time the core game loop steps, which is bound to the
         * Request Animation Frame frequency unless otherwise modified.
         * 
         * The function is passed two values: `time` and `delta`, both of which come from the game step values.
         * 
         * It must return a number. This number is used as the delta value passed to Matter.Engine.update.
         * 
         * You can override this function with your own to define your own timestep.
         * 
         * If you need to update the Engine multiple times in a single game step then call
         * `World.update` as many times as required. Each call will trigger the `getDelta` function.
         * If you wish to have full control over when the Engine updates then see the property `autoUpdate`.
         *
         * You can also adjust the number of iterations that Engine.update performs.
         * Use the Scene Matter Physics config object to set the following properties:
         *
         * positionIterations (defaults to 6)
         * velocityIterations (defaults to 4)
         * constraintIterations (defaults to 2)
         *
         * Adjusting these values can help performance in certain situations, depending on the physics requirements
         * of your game.
         *
         * @name Phaser.Physics.Matter.World#getDelta
         * @type {function}
         * @since 3.4.0
         */
        this.getDelta = GetValue(config, 'getDelta', this.update60Hz);

        /**
         * Automatically call Engine.update every time the game steps.
         * If you disable this then you are responsible for calling `World.step` directly from your game.
         * If you call `set60Hz` or `set30Hz` then `autoUpdate` is reset to `true`.
         *
         * @name Phaser.Physics.Matter.World#autoUpdate
         * @type {boolean}
         * @default true
         * @since 3.4.0
         */
        this.autoUpdate = GetValue(config, 'autoUpdate', true);

        var debugConfig = GetValue(config, 'debug', false);

        var drawDebug = (typeof(debugConfig) === 'object');

        //  Legacy version
        if (typeof(debugConfig) === 'boolean')
        {
            drawDebug = debugConfig;

            var wireframes = GetFastValue(config, 'debugWireframes', true);

            //  Old format config - remove in a later version
            debugConfig = {
                showBody: GetFastValue(config, 'debugShowBody', true),
                showStaticBody: GetFastValue(config, 'debugShowStaticBody', true),
                showSleeping: GetFastValue(config, 'debugShowSleeping', false),
                showJoint: GetFastValue(config, 'debugShowJoint', true),
                showInternalEdges: GetFastValue(config, 'debugShowInternalEdges', false),
                showConvexHulls: GetFastValue(config, 'debugShowConvexHulls', false),

                renderFill: !wireframes,
                renderStroke: wireframes,

                fillColor: GetFastValue(config, 'debugBodyFillColor', 0xe3a7e3),
                strokeColor: GetFastValue(config, 'debugBodyColor', 0xff00ff),
    
                staticFillColor: GetFastValue(config, 'debugStaticBodyColor', 0x0000ff),
                staticStrokeColor: GetFastValue(config, 'debugStaticBodyColor', 0x0000ff),
    
                staticBodySleepOpacity: 0.5,
    
                jointColor: GetFastValue(config, 'debugJointColor', 0x000000),
                hullColor: GetFastValue(config, 'debugConvexHullColor', 0xaaaaaa)
            };
        }

        /**
         * A flag that controls if the debug graphics will be drawn to or not.
         *
         * @name Phaser.Physics.Matter.World#drawDebug
         * @type {boolean}
         * @default false
         * @since 3.0.0
         */
        this.drawDebug = drawDebug;

        /**
         * An instance of the Graphics object the debug bodies are drawn to, if enabled.
         *
         * @name Phaser.Physics.Matter.World#debugGraphic
         * @type {Phaser.GameObjects.Graphics}
         * @since 3.0.0
         */
        this.debugGraphic;

        /**
         * The debug configuration object.
         *
         * @name Phaser.Physics.Matter.World#debugConfig
         * @type {Phaser.Types.Physics.Matter.MatterDebugConfig}
         * @since 3.22.0
         */
        this.debugConfig = {
            showBody: GetFastValue(debugConfig, 'showBody', true),
            showStaticBody: GetFastValue(debugConfig, 'showStaticBody', true),
            showSleeping: GetFastValue(debugConfig, 'showSleeping', false),
            showJoint: GetFastValue(debugConfig, 'showJoint', true),
            showInternalEdges: GetFastValue(debugConfig, 'showInternalEdges', false),
            showConvexHulls: GetFastValue(debugConfig, 'showConvexHulls', false),

            renderFill: GetFastValue(debugConfig, 'renderFill', true),
            renderStroke: GetFastValue(debugConfig, 'renderStroke', true),
            lineThickness: GetFastValue(debugConfig, 'lineThickness', 1),

            fillColor: GetFastValue(debugConfig, 'fillColor', 0x106909),
            strokeColor: GetFastValue(debugConfig, 'strokeColor', 0x28de19),

            staticFillColor: GetFastValue(debugConfig, 'staticFillColor', 0x0d177b),
            staticStrokeColor: GetFastValue(debugConfig, 'staticStrokeColor', 0x1327e4),

            staticBodySleepOpacity: GetFastValue(debugConfig, 'staticBodySleepOpacity', 0.7),
            sleepFillColor: GetFastValue(debugConfig, 'sleepFillColor', 0x464646),
            sleepStrokeColor: GetFastValue(debugConfig, 'sleepStrokeColor', 0x999a99),

            jointColor: GetFastValue(debugConfig, 'jointColor', 0xe0e042),
            jointLineThickness: GetFastValue(debugConfig, 'jointLineThickness', 2),

            pinSize: GetFastValue(debugConfig, 'pinSize', 4),
            pinColor: GetFastValue(debugConfig, 'pinColor', 0x42e0e0),

            springColor: GetFastValue(debugConfig, 'springColor', 0xe042e0),

            anchorColor: GetFastValue(debugConfig, 'anchorColor', 0xefefef),
            anchorSize: GetFastValue(debugConfig, 'anchorSize', 6),

            hullColor: GetFastValue(debugConfig, 'hullColor', 0xd703d0)
        };

        if (this.drawDebug)
        {
            this.createDebugGraphic();
        }

        this.setEventsProxy();
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#setEventsProxy
     * @since 3.0.0
     */
    setEventsProxy: function ()
    {
        var _this = this;
        var engine = this.engine;

        MatterEvents.on(engine, 'beforeUpdate', function (event)
        {
            _this.emit(Events.BEFORE_UPDATE, event);
        });

        MatterEvents.on(engine, 'afterUpdate', function (event)
        {
            _this.emit(Events.AFTER_UPDATE, event);
        });

        MatterEvents.on(engine, 'collisionStart', function (event)
        {
            var pairs = event.pairs;
            var bodyA;
            var bodyB;

            if (pairs.length > 0)
            {
                bodyA = pairs[0].bodyA;
                bodyB = pairs[0].bodyB;
            }

            _this.emit(Events.COLLISION_START, event, bodyA, bodyB);
        });

        MatterEvents.on(engine, 'collisionActive', function (event)
        {
            var pairs = event.pairs;
            var bodyA;
            var bodyB;

            if (pairs.length > 0)
            {
                bodyA = pairs[0].bodyA;
                bodyB = pairs[0].bodyB;
            }

            _this.emit(Events.COLLISION_ACTIVE, event, bodyA, bodyB);
        });

        MatterEvents.on(engine, 'collisionEnd', function (event)
        {
            var pairs = event.pairs;
            var bodyA;
            var bodyB;

            if (pairs.length > 0)
            {
                bodyA = pairs[0].bodyA;
                bodyB = pairs[0].bodyB;
            }

            _this.emit(Events.COLLISION_END, event, bodyA, bodyB);
        });
    },

    /**
     * Sets the bounds of the Physics world to match the given world pixel dimensions.
     * You can optionally set which 'walls' to create: left, right, top or bottom.
     * If none of the walls are given it will default to use the walls settings it had previously.
     * I.e. if you previously told it to not have the left or right walls, and you then adjust the world size
     * the newly created bounds will also not have the left and right walls.
     * Explicitly state them in the parameters to override this.
     *
     * @method Phaser.Physics.Matter.World#setBounds
     * @since 3.0.0
     *
     * @param {number} [x=0] - The x coordinate of the top-left corner of the bounds.
     * @param {number} [y=0] - The y coordinate of the top-left corner of the bounds.
     * @param {number} [width] - The width of the bounds.
     * @param {number} [height] - The height of the bounds.
     * @param {number} [thickness=128] - The thickness of each wall, in pixels.
     * @param {boolean} [left=true] - If true will create the left bounds wall.
     * @param {boolean} [right=true] - If true will create the right bounds wall.
     * @param {boolean} [top=true] - If true will create the top bounds wall.
     * @param {boolean} [bottom=true] - If true will create the bottom bounds wall.
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    setBounds: function (x, y, width, height, thickness, left, right, top, bottom)
    {
        if (x === undefined) { x = 0; }
        if (y === undefined) { y = 0; }
        if (width === undefined) { width = this.scene.sys.scale.width; }
        if (height === undefined) { height = this.scene.sys.scale.height; }
        if (thickness === undefined) { thickness = 128; }
        if (left === undefined) { left = true; }
        if (right === undefined) { right = true; }
        if (top === undefined) { top = true; }
        if (bottom === undefined) { bottom = true; }

        this.updateWall(left, 'left', x - thickness, y - thickness, thickness, height + (thickness * 2));
        this.updateWall(right, 'right', x + width, y - thickness, thickness, height + (thickness * 2));
        this.updateWall(top, 'top', x, y - thickness, width, thickness);
        this.updateWall(bottom, 'bottom', x, y + height, width, thickness);

        return this;
    },

    //  position = 'left', 'right', 'top' or 'bottom'
    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#updateWall
     * @since 3.0.0
     *
     * @param {boolean} add - [description]
     * @param {string} position - [description]
     * @param {number} x - [description]
     * @param {number} y - [description]
     * @param {number} width - [description]
     * @param {number} height - [description]
     */
    updateWall: function (add, position, x, y, width, height)
    {
        var wall = this.walls[position];

        if (add)
        {
            if (wall)
            {
                MatterWorld.remove(this.localWorld, wall);
            }

            //  adjust center
            x += (width / 2);
            y += (height / 2);

            this.walls[position] = this.create(x, y, width, height, { isStatic: true, friction: 0, frictionStatic: 0 });
        }
        else
        {
            if (wall)
            {
                MatterWorld.remove(this.localWorld, wall);
            }

            this.walls[position] = null;
        }
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#createDebugGraphic
     * @since 3.0.0
     *
     * @return {Phaser.GameObjects.Graphics} [description]
     */
    createDebugGraphic: function ()
    {
        var graphic = this.scene.sys.add.graphics({ x: 0, y: 0 });

        graphic.setDepth(Number.MAX_VALUE);

        this.debugGraphic = graphic;

        this.drawDebug = true;

        return graphic;
    },

    /**
     * Sets the world's gravity and gravity scale to 0.
     *
     * @method Phaser.Physics.Matter.World#disableGravity
     * @since 3.0.0
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    disableGravity: function ()
    {
        this.localWorld.gravity.x = 0;
        this.localWorld.gravity.y = 0;
        this.localWorld.gravity.scale = 0;

        return this;
    },

    /**
     * Sets the world's gravity
     *
     * @method Phaser.Physics.Matter.World#setGravity
     * @since 3.0.0
     *
     * @param {number} [x=0] - The world gravity x component.
     * @param {number} [y=1] - The world gravity y component.
     * @param {number} [scale] - [description]
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    setGravity: function (x, y, scale)
    {
        if (x === undefined) { x = 0; }
        if (y === undefined) { y = 1; }

        this.localWorld.gravity.x = x;
        this.localWorld.gravity.y = y;

        if (scale !== undefined)
        {
            this.localWorld.gravity.scale = scale;
        }

        return this;
    },

    /**
     * Creates a rectangle Matter body and adds it to the world.
     *
     * @method Phaser.Physics.Matter.World#create
     * @since 3.0.0
     *
     * @param {number} x - The horizontal position of the body in the world.
     * @param {number} y - The vertical position of the body in the world.
     * @param {number} width - The width of the body.
     * @param {number} height - The height of the body.
     * @param {object} options - Optional Matter configuration object.
     *
     * @return {MatterJS.Body} The Matter.js body that was created.
     */
    create: function (x, y, width, height, options)
    {
        var body = Bodies.rectangle(x, y, width, height, options);

        MatterWorld.add(this.localWorld, body);

        return body;
    },

    /**
     * Adds an object to the world.
     *
     * @method Phaser.Physics.Matter.World#add
     * @since 3.0.0
     *
     * @param {(object|object[])} object - Can be single or an array, and can be a body, composite or constraint
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    add: function (object)
    {
        MatterWorld.add(this.localWorld, object);

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#remove
     * @since 3.0.0
     *
     * @param {object} object - The object to be removed from the world.
     * @param {boolean} deep - [description]
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    remove: function (object, deep)
    {
        var body = (object.body) ? object.body : object;

        Composite.remove(this.localWorld, body, deep);

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#removeConstraint
     * @since 3.0.0
     *
     * @param {MatterJS.Constraint} constraint - [description]
     * @param {boolean} deep - [description]
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    removeConstraint: function (constraint, deep)
    {
        Composite.remove(this.localWorld, constraint, deep);

        return this;
    },

    /**
     * Adds MatterTileBody instances for all the colliding tiles within the given tilemap layer. Set
     * the appropriate tiles in your layer to collide before calling this method!
     *
     * @method Phaser.Physics.Matter.World#convertTilemapLayer
     * @since 3.0.0
     *
     * @param {(Phaser.Tilemaps.DynamicTilemapLayer|Phaser.Tilemaps.StaticTilemapLayer)} tilemapLayer -
     * An array of tiles.
     * @param {object} [options] - Options to be passed to the MatterTileBody constructor. {@ee Phaser.Physics.Matter.TileBody}
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    convertTilemapLayer: function (tilemapLayer, options)
    {
        var layerData = tilemapLayer.layer;
        var tiles = tilemapLayer.getTilesWithin(0, 0, layerData.width, layerData.height, { isColliding: true });

        this.convertTiles(tiles, options);

        return this;
    },

    /**
     * Adds MatterTileBody instances for the given tiles. This adds bodies regardless of whether the
     * tiles are set to collide or not.
     *
     * @method Phaser.Physics.Matter.World#convertTiles
     * @since 3.0.0
     *
     * @param {Phaser.Tilemaps.Tile[]} tiles - An array of tiles.
     * @param {object} [options] - Options to be passed to the MatterTileBody constructor. {@see Phaser.Physics.Matter.TileBody}
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    convertTiles: function (tiles, options)
    {
        if (tiles.length === 0)
        {
            return this;
        }

        for (var i = 0; i < tiles.length; i++)
        {
            new MatterTileBody(this, tiles[i], options);
        }

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#nextGroup
     * @since 3.0.0
     *
     * @param {boolean} isNonColliding - [description]
     *
     * @return {number} [description]
     */
    nextGroup: function (isNonColliding)
    {
        return MatterBody.nextGroup(isNonColliding);
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#nextCategory
     * @since 3.0.0
     *
     * @return {number} Returns the next unique category bitfield.
     */
    nextCategory: function ()
    {
        return MatterBody.nextCategory();
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#pause
     * @fires Phaser.Physics.Matter.Events#PAUSE
     * @since 3.0.0
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    pause: function ()
    {
        this.enabled = false;

        this.emit(Events.PAUSE);

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#resume
     * @fires Phaser.Physics.Matter.Events#RESUME
     * @since 3.0.0
     *
     * @return {Phaser.Physics.Matter.World} This Matter World object.
     */
    resume: function ()
    {
        this.enabled = true;

        this.emit(Events.RESUME);

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#update
     * @since 3.0.0
     *
     * @param {number} time - The current time. Either a High Resolution Timer value if it comes from Request Animation Frame, or Date.now if using SetTimeout.
     * @param {number} delta - The delta time in ms since the last frame. This is a smoothed and capped value based on the FPS rate.
     */
    update: function (time, delta)
    {
        if (this.enabled && this.autoUpdate)
        {
            Engine.update(this.engine, this.getDelta(time, delta), this.correction);
        }
    },

    /**
     * Manually advances the physics simulation by one iteration.
     * 
     * You can optionally pass in the `delta` and `correction` values to be used by Engine.update.
     * If undefined they use the Matter defaults of 60Hz and no correction.
     * 
     * Calling `step` directly bypasses any checks of `enabled` or `autoUpdate`.
     * 
     * It also ignores any custom `getDelta` functions, as you should be passing the delta
     * value in to this call.
     *
     * You can adjust the number of iterations that Engine.update performs internally.
     * Use the Scene Matter Physics config object to set the following properties:
     *
     * positionIterations (defaults to 6)
     * velocityIterations (defaults to 4)
     * constraintIterations (defaults to 2)
     *
     * Adjusting these values can help performance in certain situations, depending on the physics requirements
     * of your game.
     *
     * @method Phaser.Physics.Matter.World#step
     * @since 3.4.0
     *
     * @param {number} [delta=16.666] - [description]
     * @param {number} [correction=1] - [description]
     */
    step: function (delta, correction)
    {
        Engine.update(this.engine, delta, correction);
    },

    /**
     * Runs the Matter Engine.update at a fixed timestep of 60Hz.
     *
     * @method Phaser.Physics.Matter.World#update60Hz
     * @since 3.4.0
     *
     * @return {number} The delta value to be passed to Engine.update.
     */
    update60Hz: function ()
    {
        return 1000 / 60;
    },

    /**
     * Runs the Matter Engine.update at a fixed timestep of 30Hz.
     *
     * @method Phaser.Physics.Matter.World#update30Hz
     * @since 3.4.0
     *
     * @return {number} The delta value to be passed to Engine.update.
     */
    update30Hz: function ()
    {
        return 1000 / 30;
    },

    /**
     * Handles the rendering of bodies and debug information to the debug Graphics object, if enabled.
     *
     * @method Phaser.Physics.Matter.World#postUpdate
     * @private
     * @since 3.0.0
     */
    postUpdate: function ()
    {
        var config = this.debugConfig;

        var showBody = config.showBody;
        var showStaticBody = config.showStaticBody;
        var showJoint = config.showJoint;

        if (!this.drawDebug || (!showBody && !showStaticBody && !showJoint))
        {
            return;
        }

        this.debugGraphic.clear();

        var bodies = Composite.allBodies(this.localWorld);

        this.renderBodies(bodies);

        if (showJoint)
        {
            this.renderJoints();
        }
    },

    /**
     * Renders the given array of Bodies to the debug graphics instance.
     * 
     * Called automatically by the `postUpdate` method.
     *
     * @method Phaser.Physics.Matter.World#renderBodies
     * @private
     * @since 3.14.0
     * 
     * @param {array} bodies - An array of bodies from the localWorld.
     */
    renderBodies: function (bodies)
    {
        var graphics = this.debugGraphic;

        var config = this.debugConfig;

        var showBody = config.showBody;
        var showStaticBody = config.showStaticBody;
        var showSleeping = config.showSleeping;
        var showInternalEdges = config.showInternalEdges;
        var showConvexHulls = config.showConvexHulls;

        var renderFill = config.renderFill;
        var renderStroke = config.renderStroke;

        var fillColor = config.fillColor;
        var strokeColor = config.strokeColor;
        var lineThickness = config.lineThickness;

        var staticFillColor = config.staticFillColor;
        var staticStrokeColor = config.staticStrokeColor;

        var staticBodySleepOpacity = config.staticBodySleepOpacity;
        var sleepFillColor = config.sleepFillColor;
        var sleepStrokeColor = config.sleepStrokeColor;

        var hullColor = config.hullColor;

        for (var i = 0; i < bodies.length; i++)
        {
            var body = bodies[i];

            //  1) Don't show invisible bodies
            if (!body.render.visible)
            {
                continue;
            }

            //  2) Don't show static bodies, OR
            //  3) Don't show dynamic bodies
            if ((!showStaticBody && body.isStatic) || (!showBody && !body.isStatic))
            {
                continue;
            }

            var opacity = body.render.opacity;
            var lineStyle = strokeColor;
            var fillStyle = fillColor;

            if (showSleeping && body.isSleeping)
            {
                if (body.isStatic)
                {
                    opacity *= staticBodySleepOpacity;
                }
                else
                {
                    lineStyle = sleepStrokeColor;
                    fillStyle = sleepFillColor;
                }
            }

            if (body.isStatic)
            {
                lineStyle = staticStrokeColor;
                fillStyle = staticFillColor;
            }

            if (!renderFill)
            {
                fillStyle = null;
            }

            if (!renderStroke)
            {
                lineStyle = null;
            }

            this.renderBody(body, graphics, showInternalEdges, lineStyle, fillStyle, opacity, lineThickness);

            var partsLength = body.parts.length;

            if (showConvexHulls && partsLength > 1)
            {
                this.renderConvexHull(body, graphics, hullColor, lineThickness);
            }
        }
    },

    /**
     * Renders a single Matter Body to the given Phaser Graphics Game Object.
     * 
     * This method is used internally by the Matter Debug Renderer, but is also exposed publically should
     * you wish to render a Body to your own Graphics instance.
     * 
     * @method Phaser.Physics.Matter.World#renderBody
     * @since 3.22.0
     * 
     * @param {MatterJS.Body} body - The Matter Body to be rendered.
     * @param {Phaser.GameObjects.Graphics} graphics - The Graphics object to render to.
     * @param {boolean} showInternalEdges - Render internal edges of the polygon?
     * @param {number} [lineColor] - The stroke color. Set to `null` if you don't want to render a stroke.
     * @param {number} [fillColor] - The fill color. Set to `null` if you don't want to render a fill.
     * @param {number} [opacity] - The opacity, between 0 and 1. Set to `null` if you want to use the opacity defined in the Body render object.
     * @param {number} [lineThickness=1] - The stroke line thickness.
     * 
     * @return {this} This Matter World instance for method chaining.
     */
    renderBody: function (body, graphics, showInternalEdges, lineColor, fillColor, opacity, lineThickness)
    {
        if (lineColor === undefined) { lineColor = null; }
        if (fillColor === undefined) { fillColor = null; }
        if (opacity === undefined) { opacity = null; }
        if (lineThickness === undefined) { lineThickness = 1; }

        var usePartOpacity = !opacity;

        //  Handle compound parts
        var parts = body.parts;
        var partsLength = parts.length;

        for (var k = (partsLength > 1) ? 1 : 0; k < partsLength; k++)
        {
            var part = parts[k];
            var render = part.render;

            if (usePartOpacity)
            {
                opacity = render.opacity;
            }

            if (!render.visible || opacity === 0)
            {
                continue;
            }

            //  Part polygon
            var circleRadius = part.circleRadius;

            if (circleRadius)
            {
                graphics.beginPath();
                graphics.arc(part.position.x, part.position.y, circleRadius, 0, 2 * Math.PI);
            }
            else
            {
                var vertices = part.vertices;
                var vertLength = vertices.length;

                graphics.beginPath();
                graphics.moveTo(vertices[0].x, vertices[0].y);

                for (var j = 1; j < vertLength; j++)
                {
                    var vert = vertices[j];

                    if (!vertices[j - 1].isInternal || showInternalEdges)
                    {
                        graphics.lineTo(vert.x, vert.y);
                    }
                    else
                    {
                        graphics.moveTo(vert.x, vert.y);
                    }

                    if (vert.isInternal && !showInternalEdges)
                    {
                        var nextIndex = (j + 1) % vertLength;

                        graphics.moveTo(vertices[nextIndex].x, vertices[nextIndex].y);
                    }
                }
                
                graphics.closePath();
            }

            if (fillColor !== null)
            {
                graphics.fillStyle(fillColor, opacity);
                graphics.fillPath();
            }

            if (lineColor !== null)
            {
                graphics.lineStyle(lineThickness, lineColor, opacity);
                graphics.strokePath();
            }
        }

        return this;
    },

    /**
     * Renders the Convex Hull for a single Matter Body to the given Phaser Graphics Game Object.
     * 
     * This method is used internally by the Matter Debug Renderer, but is also exposed publically should
     * you wish to render a Body hull to your own Graphics instance.
     * 
     * @method Phaser.Physics.Matter.World#renderConvexHull
     * @since 3.22.0
     * 
     * @param {MatterJS.Body} body - The Matter Body to be rendered.
     * @param {Phaser.GameObjects.Graphics} graphics - The Graphics object to render to.
     * @param {number} hullColor - The stroke color used to render the hull.
     * @param {number} [lineThickness=1] - The stroke line thickness.
     * 
     * @return {this} This Matter World instance for method chaining.
     */
    renderConvexHull: function (body, graphics, hullColor, lineThickness)
    {
        if (lineThickness === undefined) { lineThickness = 1; }

        var parts = body.parts;
        var partsLength = parts.length;

        //  Render Convex Hulls
        if (partsLength > 1)
        {
            var verts = body.vertices;

            graphics.lineStyle(lineThickness, hullColor);

            graphics.beginPath();

            graphics.moveTo(verts[0].x, verts[0].y);

            for (var v = 1; v < verts.length; v++)
            {
                graphics.lineTo(verts[v].x, verts[v].y);
            }
            
            graphics.lineTo(verts[0].x, verts[0].y);

            graphics.strokePath();
        }

        return this;
    },

    /**
     * Renders all of the constraints in the world (unless they are specifically set to invisible).
     * 
     * Called automatically by the `postUpdate` method.
     *
     * @method Phaser.Physics.Matter.World#renderJoints
     * @private
     * @since 3.14.0
     */
    renderJoints: function ()
    {
        var graphics = this.debugGraphic;
        var config = this.debugConfig;

        var jointColor = config.jointColor;
        var jointLineThickness = config.jointLineThickness;
        var pinSize = config.pinSize;
        var pinColor = config.pinColor;
        var springColor = config.springColor;
        var anchorColor = config.anchorColor;
        var anchorSize = config.anchorSize;

        // Render constraints 
        var constraints = Composite.allConstraints(this.localWorld);

        for (var i = 0; i < constraints.length; i++)
        {
            this.renderConstraint(constraints[i], graphics, jointColor, jointLineThickness, springColor, pinColor, pinSize, anchorColor, anchorSize);
        }
    },

    /**
     * Renders a single Matter Constraint, such as a Pin or a Spring, to the given Phaser Graphics Game Object.
     * 
     * This method is used internally by the Matter Debug Renderer, but is also exposed publically should
     * you wish to render a Constraint to your own Graphics instance.
     * 
     * @method Phaser.Physics.Matter.World#renderConstraint
     * @since 3.22.0
     * 
     * @param {MatterJS.Constraint} constraint - The Matter Constraint to render.
     * @param {Phaser.GameObjects.Graphics} graphics - The Graphics object to render to.
     * @param {number} lineColor - The line color used when rendering this constraint.
     * @param {number} lineThickness - The line thickness.
     * @param {number} springColor - The color used when rendering, if this constraint is a spring.
     * @param {number} pinColor - The color used when rendering, if this constraint is a pin.
     * @param {number} pinSize - If this constraint is a pin, this sets the size of the pin circle.
     * @param {number} anchorColor - The color used when rendering this constraints anchors. Set to `null` to not render anchors.
     * @param {number} anchorSize - The size of the anchor circle, if this constraint has anchors and is rendering them.
     * 
     * @return {this} This Matter World instance for method chaining.
     */
    renderConstraint: function (constraint, graphics, lineColor, lineThickness, springColor, pinColor, pinSize, anchorColor, anchorSize)
    {
        var render = constraint.render;

        if (!render.visible || !constraint.pointA || !constraint.pointB)
        {
            return this;
        }

        var custom = render.custom;

        if (custom)
        {
            graphics.lineStyle(render.lineWidth, Common.colorToNumber(render.strokeStyle));
        }
        else
        {
            graphics.lineStyle(lineThickness, lineColor);
        }

        var bodyA = constraint.bodyA;
        var bodyB = constraint.bodyB;
        var start;
        var end;

        if (bodyA)
        {
            start = Vector.add(bodyA.position, constraint.pointA);
        }
        else
        {
            start = constraint.pointA;
        }

        if (render.type === 'pin')
        {
            if (!custom)
            {
                graphics.lineStyle(lineThickness, pinColor);
            }

            graphics.strokeCircle(start.x, start.y, pinSize);
        }
        else
        {
            if (bodyB)
            {
                end = Vector.add(bodyB.position, constraint.pointB);
            }
            else
            {
                end = constraint.pointB;
            }

            graphics.beginPath();
            graphics.moveTo(start.x, start.y);

            if (render.type === 'spring')
            {
                if (!custom)
                {
                    graphics.lineStyle(lineThickness, springColor);
                }

                var delta = Vector.sub(end, start);
                var normal = Vector.perp(Vector.normalise(delta));
                var coils = Math.ceil(Common.clamp(constraint.length / 5, 12, 20));
                var offset;

                for (var j = 1; j < coils; j += 1)
                {
                    offset = (j % 2 === 0) ? 1 : -1;

                    graphics.lineTo(
                        start.x + delta.x * (j / coils) + normal.x * offset * 4,
                        start.y + delta.y * (j / coils) + normal.y * offset * 4
                    );
                }
            }

            graphics.lineTo(end.x, end.y);
        }

        graphics.strokePath();

        if (render.anchors && anchorSize > 0)
        {
            graphics.fillStyle(anchorColor);
            graphics.fillCircle(start.x, start.y, anchorSize);
            graphics.fillCircle(end.x, end.y, anchorSize);
        }

        return this;
    },

    /**
     * [description]
     *
     * @method Phaser.Physics.Matter.World#fromPath
     * @since 3.0.0
     *
     * @param {string} path - [description]
     * @param {array} points - [description]
     *
     * @return {array} [description]
     */
    fromPath: function (path, points)
    {
        if (points === undefined) { points = []; }

        // var pathPattern = /L?\s*([-\d.e]+)[\s,]*([-\d.e]+)*/ig;

        // eslint-disable-next-line no-useless-escape
        var pathPattern = /L?\s*([\-\d\.e]+)[\s,]*([\-\d\.e]+)*/ig;

        path.replace(pathPattern, function (match, x, y)
        {
            points.push({ x: parseFloat(x), y: parseFloat(y) });
        });

        return points;
    },

    /**
     * Resets the internal collision IDs that Matter.JS uses for Body collision groups.
     * 
     * You should call this before destroying your game if you need to restart the game
     * again on the same page, without first reloading the page. Or, if you wish to
     * consistently destroy a Scene that contains Matter.js and then run it again
     * later in the same game.
     *
     * @method Phaser.Physics.Matter.World#resetCollisionIDs
     * @since 3.17.0
     */
    resetCollisionIDs: function ()
    {
        Body._nextCollidingGroupId = 1;
        Body._nextNonCollidingGroupId = -1;
        Body._nextCategory = 0x0001;

        return this;
    },

    /**
     * Will remove all Matter physics event listeners and clear the matter physics world,
     * engine and any debug graphics, if any.
     *
     * @method Phaser.Physics.Matter.World#shutdown
     * @since 3.0.0
     */
    shutdown: function ()
    {
        MatterEvents.off(this.engine);

        this.removeAllListeners();

        MatterWorld.clear(this.localWorld, false);

        Engine.clear(this.engine);

        if (this.drawDebug)
        {
            this.debugGraphic.destroy();
        }
    },

    /**
     * Will remove all Matter physics event listeners and clear the matter physics world,
     * engine and any debug graphics, if any.
     *
     * After destroying the world it cannot be re-used again.
     *
     * @method Phaser.Physics.Matter.World#destroy
     * @since 3.0.0
     */
    destroy: function ()
    {
        this.shutdown();
    }

});

module.exports = World;
