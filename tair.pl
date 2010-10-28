#!/usr/bin/perl -w

use CGI;

my $cgi = new CGI();

my $agi = uc($cgi->param('agi') || '');

my $filename = 'TAIR9json.txt';

my @local_accessions = split /\n/, `ls -1 TAIR9-*-json.txt`;

my $allowed_accessions = {
    'COL0' => 'TAIR9json.txt'
};

foreach my $acc (@local_accessions) {
    my $acc_code = $acc;
    $acc_code =~ s/^TAIR9-(.+)-json\.txt$/$1/;
    $allowed_accessions->{uc $acc_code} = $acc;
}


my @accessions = split /,/, ($cgi->param('accession') || 'COL0');

print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');

if ($cgi->param('agi') eq '' && $cgi->param('accession') eq '') {
    print "[";
    print join ",", map { "\"$_\"" } sort keys %$allowed_accessions;
    print "]\n";
    exit;
}

if (scalar @accessions > 1) {
    print "[";
}
foreach my $acc (@accessions) {
    if ($acc) {
        $filename = $allowed_accessions->{uc($acc || '')} || '';
    }

    if ( $agi =~ /^AT[0-9A-Z]G\d+\.\d+/) {
        open TAIR, $filename;
        while (<TAIR>) {        
            if (/\["$agi\s?"/) { 
                if (scalar @accessions > 1 && $accessions[0] ne $acc) {
                    print ",";
                }
                print $_;
            }
        }
    }
}

if (scalar @accessions > 1) {
    print "]";
}
