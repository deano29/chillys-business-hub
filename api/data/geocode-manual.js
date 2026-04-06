#!/usr/bin/env node
const https=require('https');
const fs=require('fs');
const path=require('path');

function geocode(query){
  return new Promise((resolve)=>{
    const url='https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(query)+'&format=json&limit=1&countrycodes=au';
    https.get(url,{headers:{'User-Agent':'ChillysBusinessHub/1.0'}},(resp)=>{
      let data='';
      resp.on('data',c=>data+=c);
      resp.on('end',()=>{
        try{const r=JSON.parse(data);resolve(r.length?{lat:parseFloat(r[0].lat),lng:parseFloat(r[0].lon)}:null)}
        catch{resolve(null)}
      });
    }).on('error',()=>resolve(null));
  });
}

const delay=ms=>new Promise(r=>setTimeout(r,ms));

const clients=[
  {name:'Alex Harman - NDIS Number 430984681',suburb:'Malvern',pets:'Poppie, Zena',addr:'15 Gabriel Ave, Malvern VIC 3145'},
  {name:'Allyce Hurren',suburb:'St Kilda',pets:'Halo',addr:'163 Fitzroy Street, St Kilda VIC'},
  {name:'Angela Chen',suburb:'Highett',pets:'Tully',addr:'4 Oaklands Court, Highett VIC 3190'},
  {name:'Ayona',suburb:'Chadstone',pets:'Junior',addr:'48 Railway Parade, Chadstone VIC 3148'},
  {name:'Bahar Akbaryan',suburb:'Highett',pets:'Yarra',addr:'2a Royalty Avenue, Highett VIC 3190'},
  {name:'Bella - NDIS Number - 431561499',suburb:'Croydon',pets:'Mars',addr:'3 Caromar Street, Croydon VIC 3136'},
  {name:'Chris Graham',suburb:'Carnegie',pets:'Pat',addr:'16 Rigby Avenue, Carnegie VIC 3163'},
  {name:'Darcy Wu',suburb:'Hughesdale',pets:'Jojo, Jacob',addr:'37 Bowen Street, Hughesdale VIC 3166'},
  {name:'Deborah Strange',suburb:'Bentleigh East',pets:'Winifred',addr:'59 Stockdale Avenue, Bentleigh East VIC 3165'},
  {name:'Ebony Harris',suburb:'Parkdale',pets:'Finn',addr:'143 Parkers Road, Parkdale VIC 3195'},
  {name:'Emma',suburb:'Elsternwick',pets:'Alfie',addr:'11A Gladstone Parade, Elsternwick VIC 3185'},
  {name:'Gemma',suburb:'Glen Waverley',pets:'Tycho',addr:'119 Whites Lane, Glen Waverley VIC 3150'},
  {name:'Georgia Anne Akkerman',suburb:'Malvern East',pets:'Keith',addr:'65 Darling Road, Malvern East VIC 3145'},
  {name:'Georgiana Shaw',suburb:'Cheltenham',pets:'Stan, Jeffrey',addr:'7 Timmis Ave, Cheltenham VIC 3192'},
  {name:'Gillian Clarke',suburb:'Mentone',pets:'Gator',addr:'8 Winsome Street, Mentone VIC'},
  {name:'Gloria Elina Gonzalez Guevara',suburb:'Bentleigh',pets:'',addr:'44 North Avenue, Bentleigh VIC 3204'},
  {name:'Haitham',suburb:'Murrumbeena',pets:'Roberto',addr:'25 Dunoon Street, Murrumbeena VIC 3163'},
  {name:'Helen Fernandez',suburb:'Wheelers Hill',pets:'Blue, Nova',addr:'Wheelers Hill VIC 3150'},
  {name:'Irene Giannakis',suburb:'Highett',pets:'Cooper',addr:'3 Remington Drive, Highett VIC 3190'},
  {name:'Jemma Britton',suburb:'Ashburton',pets:'Bronny',addr:'71 Ashburn Grove, Ashburton VIC 3147'},
  {name:'Jenny Astorino',suburb:'Murrumbeena',pets:'Lars',addr:'5 Hooper Street, Murrumbeena VIC 3163'},
  {name:'Karen Kanno',suburb:'Caulfield',pets:'Ezekiel',addr:'8 Birch Street, Caulfield VIC 3162'},
  {name:'Kastania',suburb:'Prahran',pets:'Alfie',addr:'72 Donald Street, Prahran VIC 3181'},
  {name:'Kylie Testa',suburb:'Carnegie',pets:'TJ',addr:'8 Holywood Grove, Carnegie VIC 3163'},
  {name:'Lisa Blethyn',suburb:'St Kilda East',pets:'Cruiz',addr:'48 Marlborough Street, St Kilda East VIC 3183'},
  {name:'Luca Balbo',suburb:'St Kilda East',pets:'Tyson',addr:'192 Alma Road, St Kilda East VIC 3183'},
  {name:'Mandy Gibson',suburb:'Elwood',pets:'Nellie',addr:'5 Joyce Street, Elwood VIC 3184'},
  {name:'Melanie Nagle',suburb:'St Kilda East',pets:'Harley',addr:'14 Hammerdale Avenue, St Kilda East VIC 3183'},
  {name:'Melissa Marshall',suburb:'Highett',pets:'',addr:'20 Major Street, Highett VIC 3190'},
  {name:'Michele Simpson',suburb:'Parkdale',pets:'Margot',addr:'21A Monaco Street, Parkdale VIC 3195'},
  {name:'Nicole Stock',suburb:'Moorabbin',pets:'Gertrude',addr:'19 Central Avenue, Moorabbin VIC 3189'},
  {name:'Noelle Krause',suburb:'Elsternwick',pets:'Oliver',addr:'6 Calista Court, Elsternwick VIC 3185'},
  {name:'Petra Naslund',suburb:'Highett',pets:'Ruby',addr:'2A Major Street, Highett VIC 3190'},
  {name:'Phillipa Callis',suburb:'Caulfield',pets:'Tux, Lilo',addr:'3 Maxwell Grove, Caulfield VIC 3162'},
  {name:'Rochelle Rich',suburb:'Bentleigh',pets:'Mojo',addr:'1D Tovan Akas Avenue, Bentleigh VIC 3204'},
  {name:'Sarah Pal',suburb:'Carnegie',pets:'Bear',addr:'6A Walden Grove, Carnegie VIC 3163'},
  {name:'Suzanne Gelbart',suburb:'McKinnon',pets:'Winston, Riley',addr:'19 Lysbeth Street, McKinnon VIC 3204'},
  {name:'Tony Tran',suburb:'Hampton East',pets:'Teddy',addr:'7 Saltair Street, Hampton East VIC 3188'},
  {name:'Travis Schindler',suburb:'Prahran',pets:'Wolf',addr:'10 Willis Street, Prahran VIC 3181'},
  {name:'Yoni Saltzman',suburb:'Caulfield North',pets:'Toffy',addr:'7 Airdrie Road, Caulfield North VIC 3161'},
];

async function main(){
  console.log('\nGeocoding '+clients.length+' clients...\n');
  const results=[];
  let ok=0,fail=0;
  for(const c of clients){
    await delay(1100);
    const r=await geocode(c.addr+', Australia');
    if(r){
      results.push({name:c.name,suburb:c.suburb,lat:r.lat,lng:r.lng,petNames:c.pets,joinDate:'',referralSource:''});
      console.log('  OK  '+c.name+' -> '+r.lat.toFixed(4)+', '+r.lng.toFixed(4));
      ok++;
    }else{
      console.log('  FAIL '+c.name+' -> '+c.addr);
      fail++;
    }
  }
  const outFile=path.join(__dirname,'..','_data','client-locations.json');
  fs.writeFileSync(outFile,JSON.stringify(results,null,2));
  console.log('\nDone: '+ok+' ok, '+fail+' failed');
  console.log('Total locations: '+results.length);
  console.log('Saved to: '+outFile);
}
main();
