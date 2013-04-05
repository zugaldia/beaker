/*
 * Please bear in mind this code happened within 24 hours, if there's
 * anything you want to know see the README and/or drop me a message
 * (use the form in zugaldia.net).
 */

// Globals
var canvas;

var delta = [ 0, 0 ];
var stage = [ window.screenX, window.screenY, window.innerWidth, window.innerHeight ];
getBrowserDimensions(true);

var themes = [ [ "#10222B", "#95AB63", "#BDD684", "#E2F0D6", "#F6FFE0" ],
		[ "#362C2A", "#732420", "#BF734C", "#FAD9A0", "#736859" ],
		[ "#0D1114", "#102C2E", "#695F4C", "#EBBC5E", "#FFFBB8" ],
		[ "#2E2F38", "#FFD63E", "#FFB54B", "#E88638", "#8A221C" ],
		[ "#121212", "#E6F2DA", "#C9F24B", "#4D7B85", "#23383D" ],
		[ "#343F40", "#736751", "#F2D7B6", "#BFAC95", "#8C3F3F" ],
		[ "#000000", "#2D2B2A", "#561812", "#B81111", "#FFFFFF" ],
		[ "#333B3A", "#B4BD51", "#543B38", "#61594D", "#B8925A" ] ];
var theme;

var worldAABB, world, iterations = 1, timeStep = 1 / 15;

var walls = [];
var beaker = [];
var wall_thickness = 200;
var wallsSetted = false;
var beakerSetted = false;

var bodies, elements, text;

var createMode = false;
var destroyMode = false;

var isMouseDown = false;
var mouseJoint;
var mouse = { x: 0, y: 0 };
var gravity = { x: 0, y: 1 };

var PI2 = Math.PI * 2;

var timeOfLastTouch = 0;

init();
play();

// Help dialog
$('#help-target').click(function() {
	$("#help-dialog").dialog({
      width: 75.0 * window.innerWidth / 100.0,
      height: 75.0 * window.innerHeight / 100.0,
      modal: true,
      buttons: {
        Ok: function() {
          $( this ).dialog( "close" );
        }
      }
    });
});

// G+ functions
var helper = (function() {
  var BASE_API_PATH = 'plus/v1/';

  return {
    /**
     * Hides the sign in button and starts the post-authorization operations.
     *
     * @param {Object} authResult An Object which contains the access token and
     *   other authentication information.
     */
    onSignInCallback: function(authResult) {
      gapi.client.load('plus','v1', function(){
        $('#authResult').html('Auth Result:<br/>');
        for (var field in authResult) {
          $('#authResult').append(' ' + field + ': ' +
              authResult[field] + '<br/>');
        }
        if (authResult['access_token']) {
          $('#authOps').show('slow');
          $('#gConnect').hide();
          helper.profile();
          // helper.people();
        } else if (authResult['error']) {
          // There was an error, which means the user is not signed in.
          // As an example, you can handle by writing to the console:
          // console.log('There was an error: ' + authResult['error']);
          // $('#authResult').append('Logged out');
          $('#authOps').hide('slow');
          $('#gConnect').show();
        }
        // console.log('authResult', authResult);
      });
    },

    /**
     * Calls the OAuth2 endpoint to disconnect the app for the user.
     */
    disconnect: function() {
      // Revoke the access token.
      $.ajax({
        type: 'GET',
        url: 'https://accounts.google.com/o/oauth2/revoke?token=' +
            gapi.auth.getToken().access_token,
        async: false,
        contentType: 'application/json',
        dataType: 'jsonp',
        success: function(result) {
          // console.log('revoke response: ' + result);
          $('#authOps').hide();
          $('#profile').empty();
          $('#visiblePeople').empty();
          $('#authResult').empty();
          $('#gConnect').show();
        },
        error: function(e) {
          // console.log(e);
        }
      });
    },

    /**
     * Gets and renders the list of people visible to this app.
     */
    people: function() {
      var request = gapi.client.plus.people.list({
        'userId': 'me',
        'collection': 'visible'
      });
      request.execute(function(people) {
        $('#visiblePeople').empty();
        $('#visiblePeople').append('Number of people visible to this app: ' +
            people.totalItems + '<br/>');
        for (var personIndex in people.items) {
          person = people.items[personIndex];
          $('#visiblePeople').append('<img src="' + person.image.url + '">');
        }
      });
    },

    /**
     * Gets and renders the currently signed in user's profile data.
     */
    profile: function(){
      var request = gapi.client.plus.people.get( {'userId' : 'me'} );
      request.execute( function(profile) {
        $('#profile').empty();
        if (profile.error) {
          $('#profile').append(profile.error);
          return;
        }
        $('#profile').append(
            $('<div>Shake it up, ' + profile.displayName + '!</div>'));
        $('#profile').append(
            $('<div><img src=\"' + profile.image.url + '&sz=100\"></div>'));
        // if (profile.cover && profile.coverPhoto) {
        //   $('#profile').append(
        //       $('<p><img src=\"' + profile.cover.coverPhoto.url + '\"></p>'));
        // }
      });
    }
  };
})();

/**
 * jQuery initialization
 */
$(document).ready(function() {
  $('#disconnect').click(helper.disconnect);
  $('#loaderror').hide();
  if ($('[data-clientid="YOUR_CLIENT_ID"]').length > 0) {
    alert('This sample requires your OAuth credentials (client ID) ' +
        'from the Google APIs console:\n' +
        '    https://code.google.com/apis/console/#:access\n\n' +
        'Find and replace YOUR_CLIENT_ID with your client ID.'
    );
  }
});

/**
 * Calls the helper method that handles the authentication flow.
 *
 * @param {Object} authResult An Object which contains the access token and
 *   other authentication information.
 */
function onSignInCallback(authResult) {
  helper.onSignInCallback(authResult);
}

// Main init and loop
function init() {

	canvas = document.getElementById( 'canvas' );

	window.addEventListener( 'deviceorientation', onWindowDeviceOrientation, false );

	// init box2d

	worldAABB = new b2AABB();
	worldAABB.minVertex.Set( -200, -200 );
	worldAABB.maxVertex.Set( window.innerWidth + 200, window.innerHeight + 200 );

	world = new b2World( worldAABB, new b2Vec2( 0, 0 ), true );

	setWalls();
	setBeaker();
	reset();
}


function play() {

	setInterval( loop, 1000 / 40 );
}

function reset() {

	var i;

	if ( bodies ) {

		for ( i = 0; i < bodies.length; i++ ) {

			var body = bodies[ i ];
			canvas.removeChild( body.GetUserData().element );
			world.DestroyBody( body );
			body = null;
		}
	}

	// color theme
	// theme = themes[ Math.random() * themes.length >> 0 ];
	theme = themes[ 3 ];
	// document.body.style[ 'backgroundColor' ] = theme[ 0 ];

	bodies = [];
	elements = [];

	$.get('js/filtered.json', function(data) {
		$.each(data, function(index, value) {
				createEventBall(value);
		});
	});
}

function onWindowDeviceOrientation( event ) {

	if ( event.beta ) {

		gravity.x = Math.sin( event.gamma * Math.PI / 180 );
		gravity.y = Math.sin( ( Math.PI / 4 ) + event.beta * Math.PI / 180 );

	}

}

function presentData(event_data) {
	components = [];

	// Where
	var location = [];
	if (event_data['city']) { location.push(event_data['city']); }
	if (event_data['state']) { location.push(event_data['state']); }
	if (event_data['country']) { location.push(event_data['country']); }
	components.push('<div>Where: ' + location.join(', ') + '</div>');

	if (event_data['location'] && event_data['location']['lat'] && event_data['location']['lng']) {
		pair = event_data['location']['lat'] + ',' + event_data['location']['lng'];
		components.push('Get <a href="https://maps.google.com/maps?q=' + pair + '" target="_blank">the map</a> for directions');
	}

	// When
	if (event_data['easy_date']) {
		var when = 'The event takes place on ' + event_data['easy_date'];
		components.push(when);
	}

	// What
	if (event_data['vertical']) {
		var vertical = 'The main focus is ' + event_data['vertical'];
		components.push(vertical);
	}

	// Who
	if (event_data['facilitators']) {
		var facilitators = [];
		$.each(event_data['facilitators'], function(index, value) {
			facilitators.push(value['first_name'] + ' ' + value['last_name']);
		});
		if (facilitators.length > 0) {
			components.push('It\'s facilitated by ' + facilitators.join(', '));
		}
	}

	// Social
	if (event_data['twitter_hashtag']) {
		var encoded_hashtag = event_data['twitter_hashtag'].replace('#', '%23');
		var twitter_link = '<a href="https://twitter.com/search?q=' + encoded_hashtag + '" target="_blank">Twitter</a>';
		var gplus_link = '<a href="https://plus.google.com/s/' + encoded_hashtag + '" target="_blank">Google+</a>';
		var hashtag = 'You can continue the conversation on ' + twitter_link + ' or ' + gplus_link + ' using the hashtag ' + event_data['twitter_hashtag'];
		components.push(hashtag);
	}

	// Link
	if (event_data['website']) {
		var website = 'More info in the <a href="http://' + event_data['website'] + '" target="_blank">official website</a>';
		$('#share-post').data('contenturl', 'http://' + event_data['website']);
		$('#share-post').data('calltoactionurl', 'http://' + event_data['website']);
		components.push(website);
	}

	// Done with content
	$('#event-info').html(components.join(' <span style="color: #aaa;">&sect;</span> ') + '.');

	// Finally, customize the G+ button
	$('#share-post').data('prefilltext', 'I\'m setting up a startup in ' + location.join(', ') + ', wanna join?');
	$('#share-post-label').text('Share the event in ' + location.join(', '));
}

function createEventBall(event_data) {
	var size;
	if (event_data['soon']) {
		size = 60;
	} else {
		size = 30;
	}

	var element = document.createElement( 'div' );
	element.width = size;
	element.height = size;
	element.style.position = 'absolute';
	element.style.left = -200 + 'px';
	element.style.top = -200 + 'px';
	element.style.cursor = "default";

	canvas.appendChild(element);
	elements.push( element );

	var circle = document.createElement( 'canvas' );
	circle.width = size;
	circle.height = size;

	var graphics = circle.getContext( '2d' );

	if (event_data['soon']) {
		graphics.fillStyle = '#3199b8';
	} else {
		graphics.fillStyle = '#534c00';
	}
	graphics.beginPath();
	graphics.arc( size * 0.5, size * 0.5, size * 0.5, 0, PI2, true );
	graphics.closePath();
	graphics.fill();

	element.appendChild( circle );

	text = document.createElement( 'div' );
	text.onSelectStart = null;
	text.innerHTML = '<span style="font-size:15px;"><strong>' + event_data['label'] + '</strong></span>';
	if (event_data['soon']) {
		text.style.color = '#eeeeee';
	} else {
		text.style.color = '#eeeeee';
	}
	text.style.position = 'absolute';
	text.style.left = '0px';
	text.style.top = '0px';
	text.style.fontFamily = 'Georgia';
	text.style.textAlign = 'center';
	element.appendChild(text);

	element.addEventListener('mouseover', function() {
		presentData(event_data);
	});

	text.style.left = ((size - text.clientWidth) / 2) +'px';
	text.style.top = ((size - text.clientHeight) / 2) +'px';

	var b2body = new b2BodyDef();

	var circle = new b2CircleDef();
	circle.radius = size / 2;
	circle.density = 1;
	circle.friction = 0.3;
	circle.restitution = 0.3;
	b2body.AddShape(circle);
	b2body.userData = {element: element};

	b2body.position.Set( stage[2] / 2.0, Math.random() * -200 );
	b2body.linearVelocity.Set( (Math.random() * 400 - 200) / 1.5, Math.random() * 400 - 200 );
	bodies.push( world.CreateBody(b2body) );
}
/*
function createBall( xInput, yInput ) {

	// var x = xInput || Math.random() * stage[2];
	var x = stage[2] / 2.0;
	var y = yInput || Math.random() * -200;

	// var size = (Math.random() * 100 >> 0) + 20;
	var size = 50;

	var element = document.createElement("canvas");
	element.width = size;
	element.height = size;
	element.style.position = 'absolute';
	element.style.left = -200 + 'px';
	element.style.top = -200 + 'px';
	element.style.WebkitTransform = 'translateZ(0)';
	element.style.MozTransform = 'translateZ(0)';
	element.style.OTransform = 'translateZ(0)';
	element.style.msTransform = 'translateZ(0)';
	element.style.transform = 'translateZ(0)';

	text = document.createElement( 'div' );
	text.onSelectStart = null;
	text.innerHTML = 'OK';
	text.style.color = theme[1];
	text.style.position = 'absolute';
	text.style.left = '0px';
	text.style.top = '0px';
	text.style.fontFamily = 'Georgia';
	text.style.textAlign = 'center';
	text.style.left = ((250 - text.clientWidth) / 2) +'px';
	text.style.top = ((250 - text.clientHeight) / 2) +'px';
	element.appendChild(text);

	var graphics = element.getContext("2d");
	graphics.fillStyle = theme[ (Math.random() * 4 >> 0) + 1];
	graphics.beginPath();
	graphics.arc(size * 0.5, size * 0.5, size * 0.5, 0, PI2, true);
	graphics.closePath();
	graphics.fill();

	canvas.appendChild(element);

	elements.push( element );

	var b2body = new b2BodyDef();

	var circle = new b2CircleDef();
	circle.radius = size >> 1;
	circle.density = 1;
	circle.friction = 0.3;
	circle.restitution = 0.3;
	b2body.AddShape(circle);
	b2body.userData = {element: element};

	b2body.position.Set( x, y );
	b2body.linearVelocity.Set( (Math.random() * 400 - 200) / 2.0, Math.random() * 400 - 200 );
	bodies.push( world.CreateBody(b2body) );
}
*/

function loop() {

	if (getBrowserDimensions()) {
		setWalls();
		setBeaker();
	}

	delta[0] += (0 - delta[0]) * 0.5;
	delta[1] += (0 - delta[1]) * 0.5;

	world.m_gravity.x = gravity.x * 350 + delta[0];
	world.m_gravity.y = gravity.y * 350 + delta[1];

	mouseDrag();
	world.Step(timeStep, iterations);

	for (i = 0; i < bodies.length; i++) {

		var body = bodies[i];
		var element = elements[i];

		element.style.left = (body.m_position0.x - (element.width >> 1)) + 'px';
		element.style.top = (body.m_position0.y - (element.height >> 1)) + 'px';

		if (element.tagName == 'DIV') {

			var style = 'rotate(' + (body.m_rotation0 * 57.2957795) + 'deg) translateZ(0)';
			text.style.WebkitTransform = style;
			text.style.MozTransform = style;
			text.style.OTransform = style;
			text.style.msTransform = style;
			text.style.transform = style;

		}

	}

}


// .. BOX2D UTILS

function createBox(world, x, y, width, height, fixed) {

	// Debug
	// console.log('new box (x, y, width, height):', x, y, width, height);

	if (typeof(fixed) == 'undefined') {

		fixed = true;

	}

	var boxSd = new b2BoxDef();

	if (!fixed) {

		boxSd.density = 1.0;

	}

	boxSd.extents.Set(width, height);

	var boxBd = new b2BodyDef();
	boxBd.AddShape(boxSd);
	boxBd.position.Set(x,y);

	return world.CreateBody(boxBd);

}

function mouseDrag()
{
	// mouse press
	if (createMode) {

		createBall( mouse.x, mouse.y );

	} else if (isMouseDown && !mouseJoint) {

		var body = getBodyAtMouse();

		if (body) {

			var md = new b2MouseJointDef();
			md.body1 = world.m_groundBody;
			md.body2 = body;
			md.target.Set(mouse.x, mouse.y);
			md.maxForce = 30000 * body.m_mass;
			// md.timeStep = timeStep;
			mouseJoint = world.CreateJoint(md);
			body.WakeUp();

		} else {

			createMode = true;

		}

	}

	// mouse release
	if (!isMouseDown) {

		createMode = false;
		destroyMode = false;

		if (mouseJoint) {

			world.DestroyJoint(mouseJoint);
			mouseJoint = null;

		}

	}

	// mouse move
	if (mouseJoint) {

		var p2 = new b2Vec2(mouse.x, mouse.y);
		mouseJoint.SetTarget(p2);
	}
}

function getBodyAtMouse() {

	// Make a small box.
	var mousePVec = new b2Vec2();
	mousePVec.Set(mouse.x, mouse.y);

	var aabb = new b2AABB();
	aabb.minVertex.Set(mouse.x - 1, mouse.y - 1);
	aabb.maxVertex.Set(mouse.x + 1, mouse.y + 1);

	// Query the world for overlapping shapes.
	var k_maxCount = 10;
	var shapes = [];
	var count = world.Query(aabb, shapes, k_maxCount);
	var body = null;

	for (var i = 0; i < count; ++i) {

		if (shapes[i].m_body.IsStatic() === false) {

			if ( shapes[i].TestPoint(mousePVec) ) {

				body = shapes[i].m_body;
				break;

			}

		}

	}

	return body;

}

/*
 * This creates the wall for the beaker
 */

function setBeaker() {
	e_thickness = 20;
	e_width= 350;
	e_heigth = 485;

	if (beakerSetted) {

		world.DestroyBody(beaker[0]);
		world.DestroyBody(beaker[1]);
		world.DestroyBody(beaker[2]);

		beaker[0] = null;
		beaker[1] = null;
		beaker[2] = null;
	}

	// Left wall
	beaker[0] = createBox(world, (stage[2] - e_width) / 2.0, stage[3], e_thickness, e_heigth);
	// Right wall
	beaker[1] = createBox(world, (stage[2] + e_width) / 2.0, stage[3], e_thickness, e_heigth);
	// Bottom
	beaker[2] = createBox(world, stage[2] / 2.0, stage[3] - 3 * e_thickness, e_width / 2.0, 2 * e_thickness);

	beakerSetted = true;
}

function setWalls() {

	if (wallsSetted) {

		world.DestroyBody(walls[0]);
		world.DestroyBody(walls[1]);
		world.DestroyBody(walls[2]);
		world.DestroyBody(walls[3]);

		walls[0] = null;
		walls[1] = null;
		walls[2] = null;
		walls[3] = null;
	}

	// var stage = [ window.screenX, window.screenY, window.innerWidth, window.innerHeight ];

	walls[0] = createBox(world,
		// center: (innerWidth / 2, - wall_thickness)
		stage[2] / 2, - wall_thickness,
		// width: (innerWidth, wall_thickness)
		stage[2], wall_thickness);
	walls[1] = createBox(world,
		// center: (innerWidth / 2, innerHeight + wall_thickness)
		stage[2] / 2, stage[3] + wall_thickness,
		// width: (innerWidth, wall_thickness)
		stage[2], wall_thickness);
	walls[2] = createBox(world,
		// center: (- wall_thickness, innerHeight / 2)
		- wall_thickness, stage[3] / 2,
		// width: (wall_thickness, innerHeight)
		wall_thickness, stage[3]);
	walls[3] = createBox(world,
		// center: (innerWidth + wall_thickness, innerHeight / 2)
		stage[2] + wall_thickness, stage[3] / 2,
		// width: (wall_thickness, innerHeight)
		wall_thickness, stage[3]);

	wallsSetted = true;

}

// BROWSER DIMENSIONS

function getBrowserDimensions(debug) {

	var changed = false;

	if (stage[0] != window.screenX) {

		delta[0] = (window.screenX - stage[0]) * 50;
		stage[0] = window.screenX;
		changed = true;

	}

	if (stage[1] != window.screenY) {

		delta[1] = (window.screenY - stage[1]) * 50;
		stage[1] = window.screenY;
		changed = true;

	}

	if (stage[2] != window.innerWidth) {

		stage[2] = window.innerWidth;
		changed = true;

	}

	if (stage[3] != window.innerHeight) {

		stage[3] = window.innerHeight;
		changed = true;

	}

	return changed;

}
