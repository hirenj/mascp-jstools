#!/usr/bin/perl

use CGI;

my $cgi = new CGI();

my $agi = uc( $cgi->param('agi') || '');

if ( $agi =~ /^AT[0-9A-Z]G\d+\.\d+/) {
    if ($cgi->request_method()) {
        print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');
    }
    open RIPPDB, 'rippdb.txt';
    while (<RIPPDB>) {    
        if (/$agi/) {            
            print $_;
        }
    }
} else {
    if ($cgi->request_method()) {
        print $cgi->header(-Content_type => 'application/json', -Access_Control_Allow_Origin => '*', -Access_Control_Allow_Methods => '*', -Access_Control_Max_Age => '1728000', -Access_Control_Allow_Headers => 'x-requested-with');    
    }
}