new function() {
    
    var _privateFunction = function() {
      console.log("I am a private function");
      console.log("This is %o",this);
      console.log("Self is %o",self);
      console.log(self.repr());
    };

    var self;
    
    var privateVariable;
        
    MASCA = function() {
        self = this;
        console.log("This is %o",this);
        MASCA.PublicClassVar = MASCA.PublicClassVar + 1;
        console.log("Public class variable "+MASCA.PublicClassVar);
        privateVariable = MASCA.PublicClassVar;
    };
    
    MASCA.prototype = {
      __class__ : MASCA,
      PublicConstant : 0,
    };
    
    MASCA.PublicClassVar = 0;
    
    MASCA.prototype.repr = function() {
        return "MASC object "+this.PublicClassVar;
    }
    
    MASCA.prototype.publicFunction = function() {
        console.log("publicFunction");
        console.log("This is %o",this);
        console.log("Self is %o",self);
        self.otherPublicFunction();
    };
    
    MASCA.prototype.otherPublicFunction = function() {
        console.log("otherPublicFunction");
        console.log("This is %o",this);
        console.log("Self is %o",self);
        console.log("Private variable is "+privateVariable);
        _privateFunction();
    }
    
}();