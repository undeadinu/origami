#!/usr/bin/env python
# This script is use to convert ori/traj file types to json
# Author: Zhonghua Xi 4/2/2015

import sys
import os
import json
import math


def convert_ori_to_json(input, output):

    print 'reading form', input
    print 'exporting to', output

    fin = open(input, 'r')
    fout = open(output, 'w')

    # read vsize
    vsize = int(fin.readline())

    ori = {}
    vertices = []
    faces = []

    for i in range(0, vsize):
        coord = [float(x) for x in fin.readline().split()]
        vertices.append(coord)

    ori['vertices'] = vertices

    # read csize

    csize = int(fin.readline())
    creases = []
    for i in range(0, csize):
        items = fin.readline().split()
        crease = [int(items[0]), int(items[1]), float(items[2]), int(items[3]), int(items[4])]
        creases.append(crease)

    ori['creases'] = creases

    # read faces

    fsize = int(fin.readline())
    faces = []
    for i in range(0, fsize):
        face = [int(x) for x in fin.readline().split()]
        faces.append(face)

    ori['faces'] = faces

    # base face
    base_face_id = int(fin.readline())
    ordered_faces = []

    # ordered face list
    for i in range(0, fsize):
        ordered_faces.append(int(fin.readline()))

    ori['base_face_id'] = base_face_id
    ori['ordered_face_ids'] = ordered_faces

    # make it a little bit human readable
    json_str = json.dumps(ori, indent=2)

    fout.write(json_str)

    fin.close()
    fout.close()

    pass

def convert_traj_to_json(input, output):   
    print 'reading form', input
    print 'exporting to', output

    with open(input, 'r') as fin:
        with open(output, 'w') as fout:
            trajs = []
            for line in fin:
                trajs.append([float(x)*math.pi/180.0 for x in line.split()])
            t = {}
            t['trajs'] = trajs
            json_str = json.dumps(t)
            fout.write(json_str)

    pass


def main():
    if len(sys.argv) < 2:
        print sys.argv[0], '*.ori / *.trj'
    else:
        for filename in sys.argv:
            if filename == sys.argv[0]: continue
            if filename.startswith('-'): continue
            
            if filename.endswith('.ori'):
                convert_ori_to_json(filename, filename+'.json')
            elif filename.endswith('.trj'):
                convert_traj_to_json(filename, filename+'.json')
            elif filename.endswith('.json'):
                print 'skipping', filename
            else:
                print 'unknown file type', filename

if __name__ == '__main__':
    main()