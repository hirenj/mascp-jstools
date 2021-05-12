import ClustalRunner from './lib/ClustalRunner';
import UniprotReader from './lib/UniprotReader';
import UserdataReader from './lib/UserdataReader';
import GenomeReader from './lib/GenomeReader';
import GatorDataReader from './lib/GatorDataReader';
import Service from './lib/Service';


import MASCP from './lib/MASCP';
import CondensedSequenceRenderer from './lib/CondensedSequenceRenderer';


import Dragger from './lib/dragger/Dragger';

MASCP.ClustalRunner = ClustalRunner;
MASCP.UniprotReader = UniprotReader;
MASCP.UserdataReader  = UserdataReader ;
MASCP.GenomeReader = GenomeReader;
MASCP.GatorDataReader = GatorDataReader;

import GatorComponent from './lib/GatorComponent';

import GeneComponent from './lib/GeneComponent';

import AlignmentComponent from './lib/AlignmentComponent';

import {default as TrackComponentScript, TrackRendererComponent, TrackComponent} from './lib/TrackRendererComponent';

MASCP.GatorComponent = GatorComponent;
MASCP.GeneComponent = GeneComponent;
MASCP.Track = TrackComponent;
MASCP.TrackComponent = TrackComponentScript;
MASCP.TrackRendererComponent = TrackRendererComponent;


export default MASCP;