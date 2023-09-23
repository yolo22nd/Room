package com.company.Objects;

import com.company.Base;
import com.company.RoomsNDoors.Bathroom;
import com.company.You;

public class Bed extends Base {
    public static String object = "  Bed   ";
    public static String name = "a bed ";
    public static int position = -10;

    public static int getPosition() {
        return position;
    }

    public void sitOnBed() {
        if (You.sitting) {
            System.out.println("you are already sitting");
        }else {
            You.sitting = true;
            System.out.println("you sat on the bed");
        }
    }

    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionBed=position;
        setHere(object,position);
        super.printMap(position);
    }
}
