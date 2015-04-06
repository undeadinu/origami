// requires:
//  jQuery
//  Three.js
//  js/extension.js

// namespace
var Origami = Origami || {};

// crease class
Origami.Crease = function(vid1, vid2, folding_angle, fid, pid) {

    // vetex indices
    this.vid1 = vid1;
    this.vid2 = vid2;

    // folding angle
    this.folding_angle = folding_angle;

    // face id
    this.fid = fid;

    // parent face id
    this.pid = pid;
}

// face class
Origami.Face = function(vid1, vid2, vid3, pid, cid) {

    // verter indices
    this.vids = [vid1, vid2, vid3];
    
    // parent face id
    this.pid = pid;
    
    // crease id
    this.cid = cid;
}

// model class
Origami.Model = function() {

    // flat vertices, array of THREE.vector3
    this.flat_vertices = [];

    // folded vertices, array of THREE.vector3
    this.vertices = [];

    // faces, array of Origami.Face
    this.faces = [];

    //  creases, array of Origami.Crease
    this.creases = [];

    // array of array of folding angles
    this.folding_path = [];

    // the parent face ids
    this.parent_face_ids = [];

    // base face id
    this.base_face_id = 0;

    // ordered face list
    this.ordered_face_ids = []; 

    // start and goal cfg
    this.start_cfg = [];
    this.goal_cfg = [];

    // three js geometry
    this.geometry = null;

    this.loaded = false;
}

Origami.Model.prototype.load = function(model_url, traj_url, callback) {
    var me = this;

    this.loaded = false;

    var my_callback = function() {
        me.loaded = true;
        if(callback) callback(me);
    }

    $.getJSON(model_url, function(model, textStatus) {
        
        // build the model
        me.build(model);

        // check trajectory file
        if(traj_url==null || traj_url.length == 0) {
            my_callback(me);
        }
        else {
            $.getJSON(traj_url, function(data, textStatus) {
                me.folding_path = data.trajs;
                my_callback(me);
            });
        }
    });
}

// build the origami model from data in string
Origami.Model.prototype.build = function(model) {
    // body...
    console.log('building origami model...');

    // bace face
    this.base_face_id = model.base_face_id;

    this.vertices = [];
    this.flat_vertices = [];

    // building vertices
    for(var i=0;i<model.vertices.length;++i)
    {
        var v = model.vertices[i];

        var vertex = new THREE.Vector3(v[0], v[1], v[2]);        

        this.vertices.push(vertex);

        // this.flat_vertices is a deep copy of this.vertices
        this.flat_vertices.push(vertex.clone());
    }

    this.faces = [];

    // building faces
    for(var i=0;i<model.faces.length;++i)
    {
        var f = model.faces[i];

        var face = new Origami.Face(f[1],f[2],f[3],f[4],f[5]);

        this.faces.push(face);
    }

    this.creases = [];

    //building creases
    for(var i=0;i<model.creases.length;++i)
    {
        var c = model.creases[i];

        var crease = new Origami.Crease(c[0], c[1], c[2], c[3], c[4]);

        this.creases.push(crease);
    }

    this.ordered_face_ids = model.ordered_face_ids;

    // set start and goal status

    this.start_cfg = [];
    this.goal_cfg = [];

    for(var i=0;i<this.creases.length;++i)
    {
        this.start_cfg.push(0);
        this.goal_cfg.push(this.creases[i].folding_angle);
    }

    this.buildThreeGeometry();

    
    console.log('built!');
};

Origami.Model.prototype.buildThreeGeometry = function() {

    // build Threejs geometry object

    this.geometry = new THREE.Geometry();
    
    // same pointer
    this.geometry.vertices = this.vertices;

    this.geometry.faces = [];


    for(var i=0;i<this.faces.length;++i)
    {
        var f = this.faces[i];
        this.geometry.faces.push(new THREE.Face3(f.vids[0], f.vids[1], f.vids[2]));
    }

    this.updateGeometry();
}

// add folding path data
Origami.Model.prototype.addFoldingPath = function(path) {    
    this.folding_path = path;
};

// fold the origami to certen percentage
Origami.Model.prototype.foldToPercentage = function(percentage) {    
    if(!this.loaded) return;

    if(percentage<0) percentage=0;
    if(percentage>1) percentage=1;

    var cfg = [];
    
    if(this.folding_path && this.folding_path.length > 0) {
        if(percentage<=0) {
            return this.foldTo(this.start_cfg); 
        } else if(percentage >=1 ) {
            return this.foldTo(this.goal_cfg);
        }

        // percentage per cfg
        var ppc = 1.0 / (this.folding_path.length-1);
        var index = Math.floor(percentage / ppc);
        // percentage in between two cfgs
        var pib = (percentage - index * ppc) / ppc;

        // if(index+1 == this.folding_path.length)
        // {
        //     console.log("index")
        // }

        cfg.linearBlend(this.folding_path[index], this.folding_path[index+1], pib);

    } else {
        cfg.linearBlend(this.start_cfg, this.goal_cfg, percentage);
    }

    this.foldTo(cfg);
};

// fold the origami to given configuration
Origami.Model.prototype.foldTo = function(cfg) {

    // folding matrices
    ms = [];

    // base face's rotation matrix is an identity matrix
    ms[this.base_face_id] = new THREE.Matrix4();

    // folding each face by computing folding matrix on the fly
    for(var i=0;i<this.ordered_face_ids.length;++i)
    {
        var fid = this.ordered_face_ids[i];

        // do not fold base face
        if(fid == this.base_face_id) continue;

        var face = this.faces[fid];    
        var crease = this.creases[face.cid];
        var folding_angle = cfg[face.cid];
        var p1 = this.vertices[crease.vid1];
        var p2 = this.vertices[crease.vid2];
        var pid = face.pid;

        // computing folding matrix
        var transform_matrix = new THREE.Matrix4();
        ms[fid] = transform_matrix.makeTransform(p1, p2, folding_angle).multiply(ms[pid]);

        // fold each vertex
        for(var j=0;j<3;j++)
        {
            var vid = face.vids[j];

            // don't fold already folded vertices along the edge itself, this causes unstable folded shape
            if(vid == crease.vid1 || vid == crease.vid2) continue;

            // fold the vertex
            this.vertices[vid].copy(this.flat_vertices[vid]).applyMatrix4(ms[fid]);
        }

    }

    this.updateGeometry();
};

Origami.Model.prototype.updateGeometry = function() {

    if(!this.geometry) return;

    this.geometry.computeBoundingSphere();

    this.geometry.computeFaceNormals();

    this.geometry.computeVertexNormals();

    this.geometry.verticesNeedUpdate = true;
    this.geometry.normalsNeedUpdate = true;
}
