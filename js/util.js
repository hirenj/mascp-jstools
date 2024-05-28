import MASCP from './lib/MASCP';

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
    headers.append('Authorization','Bearer '+MASCP.GATOR_AUTH_TOKEN);
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


let retrieveUniprot = function(uniprot) {
  return MASCP.GatorDataReader.authenticate().then(function(url_base) {
    let a_reader = new MASCP.UniprotReader();
    return new Promise((resolve,reject) => {
    a_reader.retrieve(uniprot, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.result._raw_data.data[0]);
      }
    });
    });
  });
};

export { getMetadata, getData, getExpression, getAccs, getSampleMetadata, retrieveUniprot };