#!/usr/bin/perl

use CGI;

my $cgi = new CGI();

my $agi = uc($cgi->param('agi') || '');

my $filename = 'TAIR9json.txt';

my $allowed_accessions = {
    'COL0' => 'TAIR9json.txt',
    'AGU' => 'TAIR9-Agu-json.txt',
    'BAK2' => 'TAIR9-Bak2-json.txt',
    'BAY'  => 'TAIR9-Bay-json.txt',
    'BUR0' => 'TAIR9-Bur0-json.txt',
    'CDM0' => 'TAIR9-Cdm0-json.txt',
    'DEL10' => 'TAIR9-Del10-json.txt',
    'DOG4' => 'TAIR9-Dog4-json.txt',
    'DON0' => 'TAIR9-Don0-json.txt',
    'EY152' => 'TAIR9-Ey152-json.txt',
    'FEI0' => 'TAIR9-Fei0-json.txt',
    'ISTISU1' => 'TAIR9-Istisu1-json.txt',
    'KASTEL1' => 'TAIR9-Kastel1-json.txt',
    'KOCH1' => 'TAIR9-Koch1-json.txt',
    'KRO0' => 'TAIR9-Kro0-json.txt',
    'LEO1' => 'TAIR9-Leo1-json.txt',
    'LER1' => 'TAIR9-Ler1-json.txt',
    'LERIK13' => 'TAIR9-Lerik13-json.txt',
    'MER6' => 'TAIR9-Mer6-json.txt',
    'NEMRUT1' => 'TAIR9-Nemrut1-json.txt',
    'NIE12' => 'TAIR9-Nie12-json.txt',
    'PED0' => 'TAIR9-Ped0-json.txt',
    'PRA6' => 'TAIR9-Pra6-json.txt',
    'QUI0' => 'TAIR9-Qui0-json.txt',
    'RI0' => 'TAIR9-Ri0-json.txt',
    'RUE3131' => 'TAIR9-Rue3131-json.txt',
    'SHA' => 'TAIR9-Sha-json.txt',
    'STAR8' => 'TAIR9-Star8-json.txt',,
    'TUESB303' => 'TAIR9-TueSB303-json.txt',,
    'TUEV13' => 'TAIR9-TueV13-json.txt',,
    'TUEWA12' => 'TAIR9-TueWa12-json.txt',,
    'TUESCHA9' => 'TAIR9-Tuescha9-json.txt',,
    'VASH1' => 'TAIR9-Vash1-json.txt',,
    'VIE0' => 'TAIR9-Vie0-json.txt',,
    'WALHAESB4' => 'TAIR9-WalhaesB4-json.txt',,
    'XAN1' => 'TAIR9-Xan1-json.txt',    
};

my @accessions = split /,/, ($cgi->param('accession') || 'COL0');

print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');

if (scalar @accessions > 1) {
    print "[";
}
foreach my $acc (@accessions) {
    if ($acc) {
        $filename = $allowed_accessions->{uc($acc || '')} || '';
    }

    if ( $agi =~ /^AT[0-9A-Z]G\d+\.\d/) {
        open TAIR, $filename;
        while (<TAIR>) {        
            if (/\["$agi/) { 
                print $_;
                if (scalar @accessions > 1 && $accessions[-1] ne $acc) {
                    print ",";
                }
            }
        }
    }
}

if (scalar @accessions > 1) {
    print "]";
}