import ClustalRunner from './lib/ClustalRunner.js';
import UniprotReader from './lib/UniprotReader.js';
import UserdataReader from './lib/UserdataReader.js';
import GenomeReader from './lib/GenomeReader.js';
import GatorDataReader from './lib/GatorDataReader.js';
import Service from './lib/Service.js';


import MASCP from './lib/MASCP.js';
import CondensedSequenceRenderer from './lib/CondensedSequenceRenderer.js';


import Dragger from './lib/dragger/Dragger.js';

MASCP.ClustalRunner = ClustalRunner;
MASCP.UniprotReader = UniprotReader;
MASCP.UserdataReader  = UserdataReader ;
MASCP.GenomeReader = GenomeReader;
MASCP.GatorDataReader = GatorDataReader;

import GatorComponent from './lib/GatorComponent.js';

import GeneComponent from './lib/GeneComponent.js';

import AlignmentComponent from './lib/AlignmentComponent.js';

import {default as TrackComponentScript, TrackRendererComponent, TrackComponent} from './lib/TrackRendererComponent.js';

MASCP.GatorComponent = GatorComponent;
MASCP.GeneComponent = GeneComponent;
MASCP.Track = TrackComponent;
MASCP.TrackComponent = TrackComponentScript;
MASCP.TrackRendererComponent = TrackRendererComponent;

import * as utilFuncs from './util.js';

export const util = utilFuncs;

export default MASCP;