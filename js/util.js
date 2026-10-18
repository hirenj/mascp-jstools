import MASCP from './lib/MASCP.js';

let getData = function(dataset,accession) {
  return MASCP.GatorDataReader.authenticate().then(function(url_base) {
    let a_reader = MASCP.GatorDataReader.createReader(dataset);
    a_reader.datasetname = dataset;
    return new Promise((resolve,reject) => {
      a_reader.retrieve(accession, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.result);
        }
      });
    });
  });
};

let getMetadata = function(dataset) {
  return MASCP.GatorDataReader.authenticate().then(function(url_base) {
    let headers = new Headers();
    // headers.append('Authorization','Bearer '+MASCP.GATOR_AUTH_TOKEN);
    headers.append('x-api-key',MASCP.GATOR_CLIENT_ID);
    let req_params = {
      method: 'GET',
      headers: headers
    };
    let req = new Request(`${url_base}/metadata/${dataset}`, req_params);
    return fetch(req).then( resp => resp.json());
  });
};

let getSampleMetadata = function() {
  return MASCP.GatorDataReader.authenticate().then(function(url_base) {
    let headers = new Headers();
    headers.append('Authorization','Bearer '+MASCP.GATOR_AUTH_TOKEN);
    headers.append('x-api-key',MASCP.GATOR_CLIENT_ID);
    let req_params = {
      method: 'GET',
      headers: headers
    };
    let req = new Request(`${url_base}/metadata/sources`, req_params);
    return fetch(req).then( resp => resp.json());
  });
};

let getAccs = function(accs,dataset,filter,max_chunks=10) {
  return MASCP.GatorDataReader.authenticate().then(async function(url_base) {
    let headers = new Headers();
    headers.append('Authorization','Bearer '+MASCP.GATOR_AUTH_TOKEN);
    headers.append('Content-Type','application/json');
    headers.append('x-api-key',MASCP.GATOR_CLIENT_ID);
    let remaining = accs;
    let results = [];
    while (remaining.length > 0 && max_chunks-- > 0) {
      let req_params = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ accs: remaining, filter })
      };
      let req = new Request(`${url_base}/data/latest/${dataset}`, req_params);
      let a_result = await fetch(req).then( resp => resp.json());
      results = results.concat( a_result.items.filter( item => item ) );
      remaining = a_result.unprocessed.filter( acc => acc.length > 0 );
    }
    return results;
  });
};

let hydrate_expression = (metadata,dat) => {
  let values = dat._raw_data.data;
  let locations = metadata.locations;
  let mapped_values = values.map( (locidx,idx) => {
    if ( (idx % 2) !== 0) {
      return;
    }
    let loc = locations[locidx];
    loc.expression = values[idx+1];
    return loc;
  });
  return {data: mapped_values.filter( v => v), meta: metadata };
}

let getExpression = (dataset,geneid) => {
  return getMetadata(dataset).then( meta => {
    return getData(dataset,geneid).then( hydrate_expression.bind(null,meta) );
  });
};


// Direct-to-source sequence retrieval — there is no ccg-shared-backend equivalent
// of the old Gator backend's /api/data/latest/uniprot/{ACC} (the "uniprot" dataset
// in the new pipeline is unrelated glycosylation-annotation data, not sequences),
// so this bypasses GatorDataReader/the Worker entirely. UniProt's own REST API is
// tried first (plain-text FASTA, no auth), falling back to EBI's Proteins API
// (JSON, no auth) if that fails — both URL shapes are already used elsewhere in
// this codebase (see ccg-shared-elements's mygene.js).
const UNIPROT_FASTA_URL = (acc) => `https://rest.uniprot.org/uniprotkb/${acc}.fasta`;
const EBI_PROTEINS_API_URL = (acc) => `https://www.ebi.ac.uk/proteins/api/proteins/${acc}`;

let retrieveUniprot = async function(uniprot) {
  try {
    const resp = await fetch(UNIPROT_FASTA_URL(uniprot));
    if (resp.ok) {
      const fasta = await resp.text();
      // Reuses UniprotReader's own FASTA parser (header "acc|desc", sequence body)
      // rather than re-implementing it.
      const parsed = MASCP.UniprotReader.parseFasta(fasta);
      const [seq] = Object.values(parsed)[0] || [];
      if (seq) {
        return seq;
      }
    }
  } catch (err) {
    // fall through to the EBI fallback below
  }

  const resp = await fetch(EBI_PROTEINS_API_URL(uniprot), { headers: { 'Accept': 'application/json' } });
  if (!resp.ok) {
    throw new Error(`Failed to retrieve sequence for ${uniprot}`);
  }
  const data = await resp.json();
  return data.sequence.sequence;
};

export { getMetadata, getData, getExpression, getAccs, getSampleMetadata, retrieveUniprot };